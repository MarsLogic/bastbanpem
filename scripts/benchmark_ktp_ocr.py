import os
import json
import sys
import time

# Ensure backend can be imported
sys.path.append(os.getcwd())

# Mock configuration for settings.BASE_DIR if needed
# (Assuming ktp_service.py imports it)
os.environ["ELITE_BACKEND_ENV"] = "test"

from backend.services.ktp_service import extract_ktp_data

def run_expert_benchmark(test_dir):
    print(f"--- EXPERT KTP OCR BENCHMARK ---")
    print(f"Target Directory: {test_dir}\n")
    
    all_files = []
    for root, dirs, files in os.walk(test_dir):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                all_files.append(os.path.join(root, file))
    
    if not all_files:
        print("No image files found.")
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
            
            # Simple scoring: NIK and Nama presence
            has_nik = bool(data.get("nik") and len(data["nik"]) == 16)
            has_nama = bool(data.get("nama"))
            is_warped = data.get("metadata", {}).get("is_warped", False)
            
            results.append({
                "file": filename,
                "nik": data.get("nik"),
                "nama": data.get("nama"),
                "provinsi": data.get("provinsi"),
                "kabupaten": data.get("kabupaten"),
                "kecamatan": data.get("kecamatan"),
                "desa": data.get("desa"),
                "rt": data.get("rt"),
                "rw": data.get("rw"),
                "dob": data.get("derived_dob"),
                "is_blurry": "too blurry" in data.get("error", ""),
                "latency_ms": round(elapsed, 2),
                "has_nik": has_nik,
                "has_nama": has_nama
            })
        except Exception as e:
            results.append({"file": filename, "error": str(e)})

    print("\n\n--- BENCHMARK SUMMARY ---")
    avg_latency = total_time / len(all_files)
    nik_success = sum(1 for r in results if r.get("has_nik"))
    nama_success = sum(1 for r in results if r.get("has_nama"))
    blurry_count = sum(1 for r in results if r.get("is_blurry"))

    print(f"Total Images: {len(all_files)}")
    print(f"Blurry Rejections: {blurry_count}")
    print(f"NIK Success: {nik_success} ({round(nik_success/len(all_files)*100, 1)}%)")
    print(f"Nama Success: {nama_success} ({round(nama_success/len(all_files)*100, 1)}%)")
    print(f"Avg Latency: {round(avg_latency, 2)}ms")
    
    # Save detailed report
    report_path = "output/pattern_report.json"
    os.makedirs("output", exist_ok=True)
    with open(report_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nDetailed report saved to: {report_path}")

if __name__ == "__main__":
    target = r"C:\Users\Wyx\Desktop\ktp-test\KTP"
    run_expert_benchmark(target)
