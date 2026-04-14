import requests
import json
import sys

def fetch_contracts(session_path):
    session = requests.Session()
    try:
        with open(session_path) as f:
            data = json.load(f)
            for c in data['cookies']:
                if 'pertanian.go.id' in c['domain']:
                    session.cookies.set(c['name'], c['value'], domain=c['domain'])
        
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        })
        
        url = 'https://bastbanpem.pertanian.go.id/Kontrak/json'
        # Default empty filters to get all available
        payload = {
            'eselon1': '',
            'satker': '',
            'vendor': '',
            'status_pembayaran': ''
        }
        
        print(f"Fetching contracts from {url}...")
        r = session.post(url, data=payload, timeout=30)
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            try:
                contracts_data = r.json()
                with open('tools/portal_contracts_raw.json', 'w', encoding='utf-8') as f:
                    json.dump(contracts_data, f, indent=2)
                print(f"Successfully saved {len(contracts_data.get('data', []))} contracts.")
            except:
                print("Response was not JSON. Saving to HTML debug.")
                with open('tools/portal_contracts_error.html', 'w', encoding='utf-8') as f:
                    f.write(r.text)
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    fetch_contracts('portal_session.json')
