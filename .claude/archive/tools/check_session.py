import requests
import json
import sys

def check_portal_session(session_path):
    session = requests.Session()
    try:
        with open(session_path) as f:
            data = json.load(f)
            for c in data['cookies']:
                if 'pertanian.go.id' in c['domain']:
                    session.cookies.set(c['name'], c['value'], domain=c['domain'])
        
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        })
        
        url = 'https://bastbanpem.pertanian.go.id/kontrak/listkontrakvendor'
        print(f"Connecting to {url}...")
        r = session.get(url, timeout=30)
        
        if "Login" in r.text and "Username" in r.text:
            print("SESSION EXPIRED: Redirected to login page.")
            return False
        
        print(f"SESSION ACTIVE: Status {r.status_code}")
        with open('tools/portal_debug_contracts.html', 'w', encoding='utf-8') as f:
            f.write(r.text)
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    check_portal_session('portal_session.json')
