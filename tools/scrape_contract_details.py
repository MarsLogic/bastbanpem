import requests
import json
import sys
import os

def fetch_contract_details(session_path, idkontrak):
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
        
        tabs = {
            'detail': f'https://bastbanpem.pertanian.go.id/kontrak/detail/{idkontrak}',
            'rincian': f'https://bastbanpem.pertanian.go.id/kontrak/rincian_penyaluran/{idkontrak}',
            'bast': f'https://bastbanpem.pertanian.go.id/kontrak/bast/{idkontrak}',
            'catatan': f'https://bastbanpem.pertanian.go.id/kontrak/catatan_satker/{idkontrak}'
        }
        
        out_dir = f'tools/portal_debug_{idkontrak}'
        os.makedirs(out_dir, exist_ok=True)
        
        for name, url in tabs.items():
            print(f"Fetching {name} from {url}...")
            r = session.get(url, timeout=30)
            with open(f'{out_dir}/{name}.html', 'w', encoding='utf-8') as f:
                f.write(r.text)
                
        # Also try the AJAX JSON for RPB if it exists
        rpb_url = f'https://bastbanpem.pertanian.go.id/Rincian_penyaluran/json/{idkontrak}'
        print(f"Fetching RPB JSON from {rpb_url}...")
        r_rpb = session.post(rpb_url, data={'length': 1000}, timeout=30)
        try:
            with open(f'{out_dir}/rpb.json', 'w', encoding='utf-8') as f:
                json.dump(r_rpb.json(), f, indent=2)
        except:
            pass

        print(f"Successfully scraped contract {idkontrak} to {out_dir}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    fetch_contract_details('portal_session.json', '7395')
