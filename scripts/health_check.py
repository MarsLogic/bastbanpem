import os
import sys
import json
import sqlite3
import logging

# Ensure root is in path
sys.path.append(os.getcwd())

def run_diagnostics():
    print("====================================================")
    print("   BASTBANPEM AUTOMATOR - SYSTEM DIAGNOSTICS")
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
        print("[WARN] Local Vault (bastbanpem_vault.db) not found. Will be created on start.")

    # 3. Portal Session
    session_path = "portal_session.json"
    if os.path.exists(session_path):
        try:
            with open(session_path, 'r') as f:
                data = json.load(f)
                if data.get('cookies'):
                    print(f"[OK] Portal session found ({len(data['cookies'])} cookies cached).")
                else:
                    print("[WARN] Portal session file exists but appears empty.")
        except:
            print("[FAIL] Portal session file is corrupt.")
    else:
        print("[WARN] No portal session found. Login will be required.")

    # 4. OCR Model Verification
    models_dir = "models"
    model_paths = [
        "v4/ch_PP-OCRv4_det_infer.onnx",
        "v4/ch_PP-OCRv4_rec_infer.onnx"
    ]
    missing_models = []
    for mp in model_paths:
        if not os.path.exists(os.path.join(models_dir, mp)):
            missing_models.append(mp)
    
    if not missing_models:
        print("[OK] OCR Inference models (v4) verified.")
    else:
        print(f"[FAIL] Missing OCR models: {', '.join(missing_models)}")

    # 5. License Verification
    from backend.services.license_service import LicenseService
    svc = LicenseService()
    print(f"[INFO] Machine HWID: {svc.get_machine_id()}")
    l_status = svc.validate_license()
    if l_status["status"] == "active":
        print(f"[OK] License Active (Owner: {l_status.get('data', {}).get('owner')}, Expiry: {l_status.get('data', {}).get('expiry')})")
    else:
        print(f"[WARN] License Status: {l_status['status']} - {l_status['message']}")

    print("\n----------------------------------------------------")
    print("   DIAGNOSTICS COMPLETE")
    print("----------------------------------------------------\n")

if __name__ == "__main__":
    run_diagnostics()
