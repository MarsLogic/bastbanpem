import sys
import json
import os
import requests
import argparse
import logging
import time
from typing import Optional, List, Dict, Any

# Ensure the project root is in the path for backend service imports
sys.path.append(os.getcwd())

try:
    from backend.services.ktp_service import extract_ktp_data
except ImportError:
    extract_ktp_data = None

# Configure logging
logging.basicConfig(
    level=logging.ERROR,
    format='%(asctime)s | %(levelname)s | %(message)s'
)
logger = logging.getLogger("ktp_expert_suite")

def register_recipient(nik: str, name: str) -> Dict[str, Any]:
    """
    Auto-registers the extracted recipient via the Elite Backend portal endpoint.
    """
    url = "http://127.0.0.1:8000/portal/recipients/register"
    try:
        payload = {"nik": nik, "name": name}
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            return response.json()
        return {"status": "error", "message": f"Portal registration returned status {response.status_code}"}
    except Exception as e:
        return {"status": "error", "message": f"Registration request failed: {str(e)}"}

def process_single_image(image_path: str, register: bool = False) -> Dict[str, Any]:
    """
    Expert processing for a single KTP image.
    """
    if not os.path.exists(image_path):
        return {"status": "error", "message": f"File not found: {image_path}"}
    
    if not extract_ktp_data:
        return {"status": "error", "message": "Backend KTP service is inaccessible"}

    try:
        start_time = time.time()
        result = extract_ktp_data(image_path)
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
    except Exception as e:
        return {"status": "error", "message": f"OCR Engine failure: {str(e)}"}
    
    nik = result.get("nik")
    name = result.get("nama")
    
    reg_status = None
    if register and nik and name:
        reg_status = register_recipient(nik, name)
        
    return {
        "status": "success",
        "nik": nik,
        "nama": name,
        "latency_ms": elapsed_ms,
        "registration": reg_status,
        "data": result
    }

def run_batch_benchmark(directory: str, report_name: str = "ktp_benchmark_report.json"):
    """
    Batch process a directory and generate a performance report.
    """
    print(f"\n--- EXPERT KTP OCR BATCH SUITE ---")
    print(f"Directory: {directory}")
    
    if not os.path.exists(directory):
        print(f"[ERROR] Directory not found: {directory}")
        return

    all_files = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                all_files.append(os.path.join(root, f))
    
    if not all_files:
        print("[WARN] No valid image files found in directory.")
        return

    results = []
    total_time = 0
    
    for i, img_path in enumerate(all_files):
        filename = os.path.basename(img_path)
        print(f"[{i+1}/{len(all_files)}] Processing: {filename}...", end='\r')
        
        start_time = time.time()
        try:
            data = extract_ktp_data(img_path)
            elapsed = (time.time() - start_time) * 1000
            total_time += elapsed
            
            has_nik = bool(data.get("nik") and len(data["nik"]) == 16)
            has_nama = bool(data.get("nama"))
            
            results.append({
                "file": filename,
                "nik": data.get("nik"),
                "nama": data.get("nama"),
                "latency_ms": round(elapsed, 2),
                "success": has_nik and has_nama,
                "fields": data
            })
        except Exception as e:
            results.append({"file": filename, "error": str(e)})

    avg_latency = total_time / len(all_files)
    success_count = sum(1 for r in results if r.get("success"))
    
    print("\n\n--- SUITE SUMMARY ---")
    print(f"Total Images: {len(all_files)}")
    print(f"Successful OCR: {success_count} ({round(success_count/len(all_files)*100, 1)}%)")
    print(f"Average Latency: {round(avg_latency, 2)}ms")
    
    os.makedirs("output", exist_ok=True)
    report_path = os.path.join("output", report_name)
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"Detailed report saved: {report_path}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Expert KTP OCR Suite (Bridge + Benchmark)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image", help="Process a single KTP image")
    group.add_argument("--dir", help="Benchmark a directory of KTP images")
    
    parser.add_argument("--register", action="store_true", help="Register extracted recipient in the Portal")
    parser.add_argument("--report", help="Output filename for benchmark report", default="ktp_benchmark_report.json")
    
    args = parser.parse_args()
    
    # Silence noise for clean JSON output in single-image mode
    import warnings
    warnings.filterwarnings("ignore")
    
    if args.image:
        result = process_single_image(args.image, register=args.register)
        print(json.dumps(result))
    elif args.dir:
        run_batch_benchmark(args.dir, report_name=args.report)
