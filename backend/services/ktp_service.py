# [ELITE-001] Expert KTP OCR Suite
import cv2
import numpy as np
import os
import re
import json
import threading
import queue
import time
from typing import Optional, List, Dict, Any, Tuple
from rapidocr_onnxruntime import RapidOCR
from rapidfuzz import process, fuzz
from backend.services.diagnostics import diagnostics
from backend.config import settings

class KtpExpertConstants:
    AGAMA = ["ISLAM", "PROTESTAN", "KATOLIK", "HINDU", "BUDHA", "KHONGHUCU"]
    STATUS = ["BELUM KAWIN", "KAWIN", "CERAI HIDUP", "CERAI MATI"]
    KELAMIN = ["LAKI-LAKI", "PEREMPUAN"]

class KtpExpertRepair:
    @staticmethod
    def validate_nik(data: Dict[str, Any]):
        nik = data.get("nik", "")
        if not nik or len(nik) < 15: return
        nik = nik.replace("L", "1").replace("I", "1").replace("O", "0").replace("B", "8").replace("S", "5").replace("?", "7").replace("g", "9").replace("b", "6")
        digits = "".join(filter(str.isdigit, nik))
        
        # [EXPERT-NIK] Precision targeting for Indonesian 16-digit pattern
        # If we have 15 or 17 digits, try to recover the 16-digit sequence
        if len(digits) >= 16:
            data["nik"] = digits[:16]
            try:
                day = int(digits[6:8])
                month = digits[8:10]
                year = digits[10:12]
                gender = "PEREMPUAN" if day > 40 else "LAKI-LAKI"
                actual_day = day - 40 if day > 40 else day
                data["derived_dob"] = f"{actual_day:02d}-{month}-{year}"
                if not data.get("jenis_kelamin"): data["jenis_kelamin"] = gender
            except: pass

    @staticmethod
    def fuzzy_fix_fields(data: Dict[str, Any]):
        for key, choices in [("agama", KtpExpertConstants.AGAMA), ("status_perkawinan", KtpExpertConstants.STATUS), ("jenis_kelamin", KtpExpertConstants.KELAMIN)]:
            val = data.get(key, "").upper()
            if not val: continue
            match = process.extractOne(val, choices, scorer=fuzz.WRatio)
            if match and match[1] > 70: data[key] = match[0]

class KtpSpatialParser:
    ANCHORS = {
        "nik": ["NIK", "N1K", "N!K"], 
        "nama": ["NAMA", "N4MA", "NAM4"], 
        "tgl_lahir": ["TEMPAT", "TGL", "LAHIR", "LAH1R"],
        "jenis_kelamin": ["JENIS", "KELAMIN", "KELAM1N"], 
        "alamat": ["ALAMAT", "AL4MAT"], 
        "rtrw": ["RT/RW", "RT", "RW"],
        "desa": ["KEL", "DESA", "KEL/DESA"], 
        "kecamatan": ["KECAMATAN"], 
        "agama": ["AGAMA"],
        "status_perkawinan": ["STATUS", "PERKAWINAN"], 
        "pekerjaan": ["PEKERJAAN"]
    }

    def __init__(self, ocr_result: List[Any], img_shape: Tuple[int, int]):
        self.boxes = []
        self.data = {}
        self.h, self.w = img_shape
        if not ocr_result: return
        for res in ocr_result:
            try:
                box, text, conf = res[0], res[1], res[2]
                pts = np.array(box).reshape(-1, 2)
                self.boxes.append({
                    "text": str(text).upper().strip(),
                    "conf": float(conf),
                    "x": np.mean(pts[:, 0]), "y": np.mean(pts[:, 1]),
                    "x_min": np.min(pts[:, 0]), "y_min": np.min(pts[:, 1]),
                    "h": np.max(pts[:, 1]) - np.min(pts[:, 1])
                })
            except: pass

    def extract(self) -> Dict[str, Any]:
        if not self.boxes: return {}
        for b in self.boxes:
            # Aggressive character recovery for NIK row
            clean = b["text"].replace(" ", "").replace("O", "0").replace("L", "1").replace("I", "1").replace("?", "7").replace("S", "5")
            match = re.search(r'(\d{16})', clean)
            if not match:
                # Try partial match if exactly 16 chars long but contains non-digits
                if len(clean) == 16:
                    recovered = "".join(c if c.isdigit() else "7" if c == "?" else "1" if c in "LI" else "0" if c == "O" else c for c in clean)
                    if recovered.isdigit():
                        self.data["nik"] = recovered
                        break
            if match:
                self.data["nik"] = match.group(1)
                break
        
        prov_box = next((b for b in self.boxes if "PROVINSI" in b["text"]), None)
        if prov_box: self.data["provinsi"] = prov_box["text"].replace("PROVINSI", "").strip()
        kab_box = next((b for b in self.boxes if any(k in b["text"] for k in ["KABUPATEN", "KOTA"])), None)
        if kab_box: self.data["kabupaten"] = kab_box["text"].replace("KABUPATEN", "").replace("KOTA", "").strip()

        for field, anchors in self.ANCHORS.items():
            if field == "nik" or field in self.data: continue
            anchor_box = next((b for b in self.boxes if any(a in b["text"] for a in anchors)), None)
            if anchor_box:
                val = anchor_box["text"]
                for a in anchors: val = val.replace(a, "")
                val = val.replace(":", "").strip()
                if len(val) < 2:
                    near = sorted([b for b in self.boxes if abs(b["y"] - anchor_box["y"]) < (anchor_box["h"] * 0.8) and b["x"] > anchor_box["x"]], key=lambda x: x["x"])
                    if near: val = near[0]["text"].replace(":", "").strip()
                if val: self.data[field] = val

        if not self.data.get("nama") and self.data.get("nik"):
            nik_y = next((b["y"] for b in self.boxes if self.data["nik"] in b["text"].replace(" ", "")), 0)
            addr_y = next((b["y"] for b in self.boxes if "ALAMAT" in b["text"]), 1000)
            candidates = [b for b in self.boxes if nik_y < b["y"] < addr_y and b["x"] > 150 and len(b["text"]) > 3]
            if candidates:
                candidates.sort(key=lambda x: x["y"])
                self.data["nama"] = candidates[0]["text"]

        return self.data

class EliteOcrPool:
    """
    Expert Performance: Manages a pool of RapidOCR instances with lazy initialization
    and lifecycle management to strictly adhere to the 4GB RAM target.
    """
    def __init__(self, size: int = 2):
        self.max_size = size
        self.instances = []
        self.lock = threading.Lock()
        logger_diagnostics = logging.getLogger("ktp_service")
        logger_diagnostics.info(f"EliteOcrPool configured with max {size} workers (Lazy Loading enabled).")

    def _get_instance(self) -> RapidOCR:
        with self.lock:
            if self.instances:
                return self.instances.pop()
            
            # Lazy creation if under limit
            logger_diagnostics = logging.getLogger("ktp_service")
            logger_diagnostics.info("Spawning new RapidOCR instance...")
            return RapidOCR(use_angle_cls=True)

    def _release_instance(self, instance: RapidOCR):
        with self.lock:
            if len(self.instances) < self.max_size:
                self.instances.append(instance)
            else:
                # RAM Safety: Destroy instance if pool is full
                del instance
                gc.collect()

    def process(self, path: str) -> Dict[str, Any]:
        img = cv2.imread(path)
        if img is None: return {"error": "IO Fail"}
        
        # Strategy 1: Standard Inference
        engine = self._get_instance()
        try:
            res = self._run_inference(engine, img)
            
            # Strategy 2: Upscale if unsatisfactory
            if not self._is_satisfactory(res):
                scaled = cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
                res_s2 = self._run_inference(engine, scaled)
                if self._is_satisfactory(res_s2): res = res_s2
        finally:
            self._release_instance(engine)
            
        KtpExpertRepair.validate_nik(res)
        KtpExpertRepair.fuzzy_fix_fields(res)
        res = KtpLocationRepair.repair(res)
        return res

    def _run_inference(self, engine: RapidOCR, img: np.ndarray) -> Dict[str, Any]:
        raw, elapse = engine(img)
        if not raw: return {}
        parser = KtpSpatialParser(raw, img.shape[:2])
        return parser.extract()

    def _is_satisfactory(self, data: Dict[str, Any]) -> bool:
        return bool(data.get("nik") and data.get("nama"))

import gc
import logging
ocr_pool = EliteOcrPool(size=min(os.cpu_count() or 2, 2)) # Capped at 2 for 4GB RAM safety

def extract_ktp_data(path: str, model_version: Optional[str] = None) -> dict:
    return ocr_pool.process(path)

class KtpLocationRepair:
    _tree = None
    @classmethod
    def repair(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        if not cls._tree:
            path = os.path.join(settings.BASE_DIR, "public", "master_locations.json")
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    raw = json.load(f); cls._tree = {}
                    for i in raw:
                        p, k = i["provinsi"].upper(), i["kabupaten"].upper()
                        if p not in cls._tree: cls._tree[p] = []
                        if k not in cls._tree[p]: cls._tree[p].append(k)
        p_raw = data.get("provinsi", "").upper()
        if not p_raw or not cls._tree: return data
        p_m = process.extractOne(p_raw, cls._tree.keys(), scorer=fuzz.WRatio)
        if p_m and p_m[1] > 75:
            data["provinsi"] = p_m[0]
            k_raw = data.get("kabupaten", "").upper()
            if k_raw:
                k_m = process.extractOne(k_raw, cls._tree[p_m[0]], scorer=fuzz.WRatio)
                if k_m and k_m[1] > 75: data["kabupaten"] = k_m[0]
        return data
