# [ELITE-001] Expert KTP OCR Suite
import cv2
import numpy as np
import os
import re
import json
import threading
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
        # Auto-correct common OCR errors in NIK
        nik = nik.replace("L", "1").replace("I", "1").replace("O", "0").replace("B", "8").replace("S", "5")
        digits = "".join(filter(str.isdigit, nik))
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
        
        # 1. NIK Scavenging (High priority)
        for b in self.boxes:
            clean = b["text"].replace(" ", "").replace("O", "0").replace("L", "1").replace("I", "1")
            match = re.search(r'(\d{16})', clean)
            if match:
                self.data["nik"] = match.group(1)
                break
        
        # 2. Header (Provinsi/Kabupaten)
        prov_box = next((b for b in self.boxes if "PROVINSI" in b["text"]), None)
        if prov_box: self.data["provinsi"] = prov_box["text"].replace("PROVINSI", "").strip()
        kab_box = next((b for b in self.boxes if any(k in b["text"] for k in ["KABUPATEN", "KOTA"])), None)
        if kab_box: self.data["kabupaten"] = kab_box["text"].replace("KABUPATEN", "").replace("KOTA", "").strip()

        # 3. Anchor-Value Spatial Binding
        for field, anchors in self.ANCHORS.items():
            if field == "nik" or field in self.data: continue
            anchor_box = next((b for b in self.boxes if any(a in b["text"] for a in anchors)), None)
            if anchor_box:
                # Value extraction
                val = anchor_box["text"]
                for a in anchors: val = val.replace(a, "")
                val = val.replace(":", "").strip()
                if len(val) < 2:
                    # Look right
                    near = sorted([b for b in self.boxes if abs(b["y"] - anchor_box["y"]) < (anchor_box["h"] * 0.8) and b["x"] > anchor_box["x"]], key=lambda x: x["x"])
                    if near: val = near[0]["text"].replace(":", "").strip()
                if val: self.data[field] = val

        # 4. Fallback: If Nama is missing, look for text above ALAMAT but below NIK
        if not self.data.get("nama") and self.data.get("nik"):
            nik_y = next((b["y"] for b in self.boxes if self.data["nik"] in b["text"].replace(" ", "")), 0)
            addr_y = next((b["y"] for b in self.boxes if "ALAMAT" in b["text"]), 1000)
            candidates = [b for b in self.boxes if nik_y < b["y"] < addr_y and b["x"] > 150 and len(b["text"]) > 3]
            if candidates:
                candidates.sort(key=lambda x: x["y"])
                self.data["nama"] = candidates[0]["text"]

        return self.data

class EliteOcrEngine:
    def __init__(self):
        self.engine = RapidOCR(use_angle_cls=True)
        self.lock = threading.Lock()

    def process(self, path: str) -> Dict[str, Any]:
        img = cv2.imread(path)
        if img is None: return {"error": "IO Fail"}
        
        # Strategy 1: Standard
        res = self._run_inference(img)
        if not self._is_satisfactory(res):
            # Strategy 2: Multi-Scale 1.5x
            scaled = cv2.resize(img, None, fx=1.5, fy=1.5, interpolation=cv2.INTER_CUBIC)
            res_s2 = self._run_inference(scaled)
            if self._is_satisfactory(res_s2): res = res_s2
            
        # Expert Repairs
        KtpExpertRepair.validate_nik(res)
        KtpExpertRepair.fuzzy_fix_fields(res)
        res = KtpLocationRepair.repair(res)
        return res

    def _run_inference(self, img: np.ndarray) -> Dict[str, Any]:
        with self.lock:
            raw, elapse = self.engine(img)
        if not raw: return {}
        parser = KtpSpatialParser(raw, img.shape[:2])
        return parser.extract()

    def _is_satisfactory(self, data: Dict[str, Any]) -> bool:
        return bool(data.get("nik") and data.get("nama"))

ocr_engine = EliteOcrEngine()

def extract_ktp_data(path: str, model_version: Optional[str] = None) -> dict:
    return ocr_engine.process(path)

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
