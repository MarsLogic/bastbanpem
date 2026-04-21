import requests
import sys

def check_app():
    base_url = "http://127.0.0.1:8000"
    print(f"Testing App at {base_url}...")
    
    try:
        # 1. Check /
        r = requests.get(base_url)
        print(f"[/] Status: {r.status_code}")
        if "Contract Management" in r.text:
            print("[/] SUCCESS: Served index.html")
        else:
            print("[/] FAILURE: index.html not found in response")
            print(f"Response snippet: {r.text[:200]}")
            
        # 2. Check /health
        r = requests.get(f"{base_url}/health")
        print(f"[/health] Status: {r.status_code}")
        print(f"[/health] Content: {r.text}")
        
        # 3. Check /assets/
        # Need to find the actual filename from index.html
        import re
        match = re.search(r'src="/assets/(index-[^"]+\.js)"', r.text)
        if match:
            js_file = match.group(1)
            print(f"Found JS asset: {js_file}")
            r = requests.get(f"{base_url}/assets/{js_file}")
            print(f"[/assets/{js_file}] Status: {r.status_code}")
            if r.status_code == 200:
                print(f"[/assets/{js_file}] Success: {len(r.content)} bytes")
            else:
                print(f"[/assets/{js_file}] FAILURE")
        else:
            print("Could not find JS asset in index.html")
            
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")

if __name__ == "__main__":
    check_app()
