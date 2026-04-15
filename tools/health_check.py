import os
import sys
import json
import sqlite3
import requests
import time
import subprocess
import logging

# Ensure root is in path
sys.path.append(os.getcwd())

def run_system_diagnostics():
    print("====================================================")
    print("   BASTBANPEM AUTOMATOR - EXPERT DIAGNOSTICS")
    print("====================================================\n")

    # 1. Environment & Venv
    if os.path.exists(".venv"):
        print("[OK] Python Virtual Environment (.venv) detected.")
    else:
        print("[FAIL] Virtual Environment missing.")

    # 2. Database Integrity
    db_path = "bastbanpem_vault.db"
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
            conn.close()
            print("[OK] SQLite Vault detected and readable.")
        except Exception as e:
            print(f"[FAIL] Database corruption detected: {e}")
    else:
        print("[WARN] Local Vault (bastbanpem_vault.db) not found.")

    # 3. Portal Session
    session_path = "portal_session.json"
    if os.path.exists(session_path):
        try:
            with open(session_path, 'r') as f:
                data = json.load(f)
                if data.get('cookies'):
                    print(f"[OK] Portal session found ({len(data['cookies'])} cookies cached).")
                else:
                    print("[WARN] Portal session file exists but is empty.")
        except:
            print("[FAIL] Portal session file is corrupt.")
    else:
        print("[WARN] No portal session found.")

    # 4. OCR Model Verification
    models_dir = "models"
    model_paths = ["v4/ch_PP-OCRv4_det_infer.onnx", "v4/ch_PP-OCRv4_rec_infer.onnx"]
    missing = [mp for mp in model_paths if not os.path.exists(os.path.join(models_dir, mp))]
    if not missing:
        print("[OK] OCR Inference models (v4) verified.")
    else:
        print(f"[FAIL] Missing OCR models: {', '.join(missing)}")

    # 5. License & HWID
    try:
        from backend.services.license_service import LicenseService
        svc = LicenseService()
        print(f"[INFO] Machine HWID: {svc.get_machine_id()}")
        l_status = svc.validate_license()
        if l_status["status"] == "active":
            owner = l_status.get('data', {}).get('owner', 'Unknown')
            print(f"[OK] License Active (Owner: {owner})")
        else:
            print(f"[WARN] License Status: {l_status['status']}")
    except Exception as e:
        print(f"[FAIL] License Service error: {e}")

    # 6. Stack Check (FastAPI)
    print("\nStarting temporary backend for stack check...")
    try:
        # Determine python executable
        py_exe = ".\\.venv\\Scripts\\python.exe" if os.name == 'nt' else "./.venv/bin/python"
        p = subprocess.Popen([py_exe, "backend/main.py"], 
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                             env={**os.environ, "PYTHONPATH": "."})
        time.sleep(4) # Wait for startup
        
        try:
            resp = requests.get("http://127.0.0.1:8000/health", timeout=5)
            if resp.status_code == 200:
                print("[OK] FastAPI backend is responsive and healthy.")
            else:
                print(f"[FAIL] FastAPI health check returned {resp.status_code}")
        except Exception as e:
            print(f"[FAIL] Could not connect to backend: {e}")
        finally:
            p.terminate()
            p.wait()
    except Exception as e:
        print(f"[FAIL] Could not spawn backend: {e}")

    print("\n----------------------------------------------------")
    print("   DIAGNOSTICS COMPLETE")
    print("----------------------------------------------------\n")

if __name__ == "__main__":
    run_system_diagnostics()
