import cv2
import numpy as np
import os
import re
from typing import Optional, List, Dict, Any
from rapidocr_onnxruntime import RapidOCR
from backend.services.diagnostics import diagnostics
from backend.services.hardware_orchestrator import HardwareOrchestrator
from backend.models import KtpResult
from backend.config import settings

class EliteOcrEngine:
    def __init__(self):
        self.engine = None
        self.current_version = None
        self.initialize_engine()

    def initialize_engine(self):
        """
        Elite Initialization: Hardware-aware model selection (v4 vs v5).
        Optimized for portable execution from a 'models' folder.
        """
        caps = HardwareOrchestrator.get_system_capabilities()
        providers = HardwareOrchestrator.get_onnx_providers()
        
        target_version = caps["recommended_ocr_version"]
        
        # Define Model Paths (Portable Pattern)
        models_dir = settings.MODELS_DIR
        
        paths = {
            "v5": {
                "det": os.path.join(models_dir, "v5", "ch_PP-OCRv5_det_infer.onnx"),
                "rec": os.path.join(models_dir, "v5", "ch_PP-OCRv5_rec_infer.onnx"),
                "keys": os.path.join(models_dir, "v5", "ppocr_keys_v1.txt")
            },
            "v4": {
                "det": os.path.join(models_dir, "v4", "ch_PP-OCRv4_det_infer.onnx"),
                "rec": os.path.join(models_dir, "v4", "ch_PP-OCRv4_rec_infer.onnx")
            }
        }

        # --- ATTEMPT 1: Load Target Version (v5 or v4) ---
        try:
            p = paths.get(target_version)
            if p and os.path.exists(p["det"]) and os.path.exists(p["rec"]):
                diagnostics.log_breadcrumb("OCR", f"Loading Engine {target_version} (Recommended)")
                
                # Build initialization arguments
                ocr_kwargs = {
                    "det_model_path": p["det"],
                    "rec_model_path": p["rec"],
                    "providers": providers,
                    "use_angle_cls": True # Always detect rotation
                }
                
                # v5 usually requires explicit keys path for better accuracy
                if "keys" in p and os.path.exists(p["keys"]):
                    ocr_kwargs["rec_keys_path"] = p["keys"]
                
                # Mobile/Quantized models often perform better with standard shapes
                if target_version == "v4":
                    ocr_kwargs["cls_image_shape"] = [3, 48, 192]
                else:
                    ocr_kwargs["cls_image_shape"] = [3, 80, 160]

                self.engine = RapidOCR(**ocr_kwargs)
                self.current_version = target_version
            else:
                diagnostics.log_breadcrumb("OCR", f"Target models {target_version} missing at {models_dir}, falling back to internal")
                self.engine = RapidOCR(providers=providers, use_angle_cls=True)
                self.current_version = "internal"
        except Exception as e:
            diagnostics.log_error("OCR-INIT-FAIL", f"Failed to load {target_version}: {str(e)}")
            try:
                self.engine = RapidOCR(use_angle_cls=True) # Last resort default
                self.current_version = "default"
            except:
                self.engine = None
                self.current_version = "failed"

        # --- SESSION WARMUP (Anti-Lag Pattern) ---
        if self.engine:
            try:
                # Perform a dummy inference on a 32x32 black pixel to 'pre-heat' ONNX shaders.
                # This avoids the 1-2 minute lag on integrated GPUs at the start of the first real image.
                dummy_img = np.zeros((32, 32, 3), dtype=np.uint8)
                self.engine(dummy_img)
                diagnostics.log_breadcrumb("OCR", "Session warmup complete.")
            except Exception as we:
                diagnostics.log_error("OCR-WARMUP-FAIL", str(we))

    def process_ktp(self, image_path: str) -> dict:
        if not self.engine:
            return {"error": "OCR Engine not initialized"}

        filename = os.path.basename(image_path)
        turbo_nik = self.turbo_match_nik(filename)
        
        processed_img = self.preprocess_image(image_path)
        if processed_img is None:
            return {"nik": turbo_nik, "error": "Failed to read/preprocess image"}
            
        result, elapse = self.engine(processed_img)
        
        if not result and not turbo_nik:
            return {"error": "No text detected"}

        full_text = []
        confidences = []
        ocr_nik = None
        potential_names = []
        img_height = processed_img.shape[0]
        
        if result:
            for line in result:
                box = line[0] # [x1, y1, x2, y2, x3, y3, x4, y4]
                text = str(line[1]).upper().strip()
                conf = float(line[2])
                
                full_text.append(text)
                confidences.append(conf)
                
                # Coordinate-Aware NIK Extraction (SmartBind Pattern)
                # Remove spaces/noise for digit check
                clean_line = text.replace(' ', '').replace(':', '').replace('-', '')
                nik_match = re.search(r'(\d{16})', clean_line)
                if nik_match and not ocr_nik:
                    # NIK is typically in the upper 45% of the KTP card
                    avg_y = sum([box[1], box[3], box[5], box[7]]) / 4
                    if avg_y < (img_height * 0.45):
                        ocr_nik = nik_match.group(1)
                
                # Nama extraction (look for NAMA keyword or lines shortly after NIK)
                if "NAMA" in text or (ocr_nik and not potential_names):
                    clean_name = self.clean_artifact_text(text)
                    if len(clean_name) > 3 and clean_name != ocr_nik:
                        potential_names.append(clean_name)

        final_nik = turbo_nik or ocr_nik
        nama = potential_names[0] if potential_names else None
        
        # Simple cleanup if name looks like a keyword
        if nama and any(k in nama for k in ["NIK", "PROVINSI", "ALAMAT"]):
            nama = None

        return {
            "nik": final_nik,
            "nama": nama,
            "confidence": round(sum(confidences) / len(confidences), 4) if confidences else 1.0 if turbo_nik else 0.0,
            "metadata": {
                "version": self.current_version,
                "elapsed_ms": round(elapse * 1000, 2) if isinstance(elapse, (int, float)) else 0,
                "is_turbo": bool(turbo_nik and not ocr_nik)
            }
        }

    def preprocess_image(self, path):
        """
        Elite Preprocessing: Blue Channel Isolation + CLAHE.
        Suppresses cyan/blue KTP background to isolate black text.
        """
        img = cv2.imread(path)
        if img is None: return None
        
        # 1. Resize for RAM optimization if massive
        h, w = img.shape[:2]
        if max(h, w) > 1500:
            scale = 1500 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)))

        # 2. Blue channel isolation
        blue = img[:,:,0]
        
        # 3. CLAHE
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(blue)
        
        return enhanced

    def turbo_match_nik(self, filename):
        """Instant NIK discovery from filename."""
        match = re.search(r'(\d{16})', filename)
        return match.group(1) if match else None

    def clean_artifact_text(self, text):
        """Removes common OCR prefix noise."""
        cleaned = re.sub(r'[^A-Z0-9\s\.\,\-\/]', '', text.upper())
        for art in ["NIK", "NAMA", "PROVINSI", "KABUPATEN", "ALAMAT", ":", " -"]:
            cleaned = cleaned.replace(art, "").strip()
        return cleaned

# Singleton Instance
ocr_engine = EliteOcrEngine()

def extract_ktp_data(image_path: str) -> dict:
    """Entry point for FastAPI router."""
    return ocr_engine.process_ktp(image_path)
