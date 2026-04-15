import os
import sys
import json
import re
import importlib.util
import requests
import time

# Add parent dir to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check_dependencies():
    print("[1/5] Checking Python Dependencies...")
    with open('requirements.txt', 'r') as f:
        deps = [line.split('==')[0].split('<')[0].split('>=')[0].strip() for line in f if line.strip() and not line.startswith('#')]
    
    missing = []
    for dep in deps:
        if importlib.util.find_spec(dep.replace('-', '_')) is None:
            # Special cases
            if dep == 'pymupdf' and importlib.util.find_spec('fitz'): continue
            if dep == 'pydantic-settings' and importlib.util.find_spec('pydantic_settings'): continue
            if dep == 'py-cpuinfo' and importlib.util.find_spec('cpuinfo'): continue
            if dep == 'opencv-python-headless' and importlib.util.find_spec('cv2'): continue
            missing.append(dep)
    
    if missing:
        print(f"  [!] Missing: {', '.join(missing)}")
    else:
        print("  [OK] All Python dependencies found.")

def check_hardcoded_paths():
    print("[2/5] Scanning for Hardcoded Paths/Secrets...")
    patterns = [
        (r'C:\\Users\\', "Absolute Windows Path"),
        (r'/home/', "Absolute Linux Path"),
        (r'api_key\s*=\s*[\'"][a-zA-Z0-9]{10,}[\'"]', "Potential API Key"),
        (r'password\s*=\s*[\'"][a-zA-Z0-9]{5,}[\'"]', "Potential Password")
    ]
    
    issues = []
    for root, _, files in os.walk('backend'):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    for pattern, desc in patterns:
                        if re.search(pattern, content):
                            issues.append(f"  {desc} in {path}")
                            
    if issues:
        for issue in issues: print(issue)
    else:
        print("  [OK] No obvious hardcoded secrets or absolute paths found in backend.")

def check_orphaned_code():
    print("[3/5] Checking for Orphaned Backend Files...")
    # Basic check: is the file imported in router or main?
    with open('backend/api/router.py', 'r') as f: router_content = f.read()
    with open('backend/main.py', 'r') as f: main_content = f.read()
    
    backend_files = []
    for root, _, files in os.walk('backend/services'):
        for file in files:
            if file.endswith('.py') and not file.startswith('__'):
                backend_files.append(file.replace('.py', ''))
                
    orphaned = []
    for bf in backend_files:
        if bf not in router_content and bf not in main_content:
            # Check if imported by other services
            is_used = False
            for root, _, files in os.walk('backend/services'):
                for f in files:
                    if f.endswith('.py') and f.replace('.py', '') != bf:
                        with open(os.path.join(root, f), 'r') as s:
                            if bf in s.read():
                                is_used = True
                                break
            if not is_used: orphaned.append(bf)
            
    if orphaned:
        print(f"  [!] Potentially unused services: {', '.join(orphaned)}")
    else:
        print("  [OK] All backend services seem to be utilized.")

def check_api_health():
    print("[4/5] Checking API Route Integrity...")
    try:
        response = requests.get("http://127.0.0.1:8000/health", timeout=2)
        if response.status_code == 200:
            print("  [OK] Backend is reachable at :8000/health")
        else:
            print(f"  [!] Backend returned status {response.status_code}")
    except:
        print("  [!] Backend unreachable. Start it manually with start.bat for live health check.")

def audit_data_structures():
    print("[5/5] Auditing Data Structures Alignment...")
    # Check if PipelineRow matches expected Portal structure
    from backend.models import PipelineRow
    fields = PipelineRow.model_fields.keys()
    required = ['idkontrak', 'idtermin', 'idbast', 'pn_nik', 'evidence']
    missing = [r for r in required if r not in fields]
    
    if missing:
        print(f"  [!] PipelineRow missing portal fields: {', '.join(missing)}")
    else:
        print("  [OK] PipelineRow is fully aligned with Portal requirements.")

if __name__ == "__main__":
    print("--- BASTBANPEM EXPERT AUDIT ---")
    check_dependencies()
    check_hardcoded_paths()
    check_orphaned_code()
    check_api_health()
    audit_data_structures()
    print("--- AUDIT COMPLETE ---")
