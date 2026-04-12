import psutil
import cpuinfo
import os
import multiprocessing
from typing import Dict, Any

class HardwareOrchestrator:
    @staticmethod
    def get_system_capabilities() -> Dict[str, Any]:
        """
        Elite hardware detection to scale the stack.
        Optimized for 4GB RAM / i5-10th Gen baseline.
        """
        mem = psutil.virtual_memory()
        total_gb = mem.total / (1024**3)
        
        info = cpuinfo.get_cpu_info()
        brand = info.get('brand_raw', '').lower()
        is_intel = 'intel' in brand
        is_amd = 'amd' in brand
        cpu_cores = multiprocessing.cpu_count()
        
        # Elite Scoring for OCR Model Selection
        # Score >= 10: High End (v5 Server)
        # Score < 10: Low End (v4 Mobile / Quantized)
        score = 0
        if total_gb >= 7.5: score += 10
        elif total_gb >= 3.5: score += 5
        
        if cpu_cores >= 8: score += 5
        elif cpu_cores >= 4: score += 2
        
        # Check for AVX-512 (Intel 10th Gen+ special instruction)
        has_avx512 = 'avx512' in info.get('flags', [])
        if has_avx512: score += 3

        # Model Existence Check
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        models_dir = os.path.join(base_path, "models")
        v5_exists = os.path.exists(os.path.join(models_dir, "v5", "ch_PP-OCRv5_det_infer.onnx"))
        v4_exists = os.path.exists(os.path.join(models_dir, "v4", "ch_PP-OCRv4_det_infer.onnx"))

        # Final recommendation logic with filesystem validation
        recommended_version = "v5" if score >= 10 else "v4"
        
        # Auto-fallback if preferred version is missing
        if recommended_version == "v5" and not v5_exists and v4_exists:
            recommended_version = "v4"
        elif recommended_version == "v4" and not v4_exists and v5_exists:
            recommended_version = "v5"
        
        return {
            "total_ram_gb": round(total_gb, 1),
            "cpu_cores": cpu_cores,
            "is_intel": is_intel,
            "is_amd": is_amd,
            "has_avx512": has_avx512,
            "score": score,
            "recommended_ocr_version": recommended_version,
            "models_available": {"v4": v4_exists, "v5": v5_exists},
            "recommended_threads": min(cpu_cores, 4) if total_gb < 4 else cpu_cores
        }

    @staticmethod
    def get_onnx_providers():
        """
        Auto-switch to GPU (DirectML for Intel/AMD/Nvidia on Windows) 
        if hardware is high-end, else stick to CPU.
        """
        caps = HardwareOrchestrator.get_system_capabilities()
        
        # Default providers
        providers = ['CPUExecutionProvider']
        
        # Only enable GPU if 8GB+ RAM is present to avoid shared memory OOM.
        if caps["total_ram_gb"] >= 7.5:
            # Note: requires onnxruntime-directml
            providers.insert(0, 'DmlExecutionProvider')
            
        return providers
