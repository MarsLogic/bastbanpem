import requests
import time
import subprocess
import os

def check_stack():
    print("--- Stack Health Check ---")
    
    # 1. Check Python Venv
    if os.path.exists(".venv"):
        print("[OK] Virtual environment found.")
    else:
        print("[FAIL] Virtual environment not found.")
        return

    # 2. Check Backend
    print("Starting backend...")
    p = subprocess.Popen([".\\.venv\\Scripts\\python.exe", "backend/main.py"], 
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(3)
    
    try:
        resp = requests.get("http://127.0.0.1:8000/health")
        if resp.status_code == 200 and resp.json()["status"] == "ok":
            print("[OK] FastAPI backend is responsive.")
        else:
            print(f"[FAIL] FastAPI health check failed: {resp.status_code}")
    except Exception as e:
        print(f"[FAIL] Could not connect to backend: {e}")
    finally:
        p.terminate()

    # 3. Check imports
    print("Checking core library imports...")
    try:
        import polars as pl
        import fitz
        import webview
        from fastapi import FastAPI
        print("[OK] Core libraries (Polars, PyMuPDF, PyWebView, FastAPI) are available.")
    except ImportError as e:
        print(f"[FAIL] Missing library: {e}")

if __name__ == "__main__":
    check_stack()
