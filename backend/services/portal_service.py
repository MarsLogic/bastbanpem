import requests
import json
import os
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("portal_service")

class PortalService:
    def __init__(self, session_path: str = "portal_session.json"):
        # The session file is at the root of the project
        self.session_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", session_path))
        self.session = requests.Session()
        self.base_url = "https://bastbanpem.pertanian.go.id"
        self._load_session()

    def _load_session(self):
        try:
            if not os.path.exists(self.session_path):
                logger.error(f"Portal session file missing at {self.session_path}")
                return

            with open(self.session_path) as f:
                data = json.load(f)
                for c in data.get('cookies', []):
                    if 'pertanian.go.id' in c.get('domain', ''):
                        self.session.cookies.set(c['name'], c['value'], domain=c['domain'])
            
            self.session.headers.update({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            })
            logger.info("Portal session loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load portal session: {e}")

    def fetch_contracts(self) -> List[Dict]:
        url = f"{self.base_url}/Kontrak/json"
        payload = {
            'eselon1': '',
            'satker': '',
            'vendor': '',
            'status_pembayaran': ''
        }
        try:
            r = self.session.post(url, data=payload, timeout=30)
            if r.status_code == 200:
                return r.json().get('data', [])
            return []
        except Exception as e:
            logger.error(f"Error fetching portal contracts: {e}")
            return []

    def fetch_contract_details(self, idkontrak: str) -> Dict:
        # Fetch RPB (Rincian Penerima Bantuan)
        rpb_url = f"{self.base_url}/kontrak/json_kontrak_penyaluran_penerima/{idkontrak}"
        try:
            r = self.session.post(rpb_url, data={'length': 5000}, timeout=30)
            recipients = []
            if r.status_code == 200:
                recipients = r.json().get('data', [])
            
            # Fetch metadata from main list
            all_contracts = self.fetch_contracts()
            meta = next((c for c in all_contracts if c['idkontrak'] == idkontrak), {})
            
            return {
                **meta,
                "recipients": recipients
            }
        except Exception as e:
            logger.error(f"Error fetching contract details for {idkontrak}: {e}")
            return {}

    def sync_recipient(self, idkontrak: str, data: dict):
        # Implementation for /kontrak/tambah_rincian
        url = f"{self.base_url}/kontrak/tambah_rincian"
        payload = {
            'idkontrak': idkontrak,
            'dt[pn_nik]': data.get('nik'),
            'dt[pn_nama]': data.get('name'),
            'dt[pn_qty_disalurkan]': data.get('qty'),
            'dt[pn_nilai_disalurkan]': data.get('value'),
            'dt[tipe_kontrak]': 'Barang'
        }
        try:
            r = self.session.post(url, data=payload, timeout=30)
            logger.info(f"Sync result for {data.get('nik')}: {r.text}")
            return {"status": "success" if "Success" in r.text else "error", "message": r.text}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def upload_proof(self, idkontrak: str, idpenerima: str, file_path: str, field_name: str, prefix: str = ""):
        url = f"{self.base_url}/kontrak/proses_upload_do_bukti"
        
        if not os.path.exists(file_path):
            return {"status": "error", "message": f"File not found: {file_path}"}

        if os.path.getsize(file_path) > 2000 * 1024:
            return {"status": "error", "message": "File size exceeds 2MB limit"}

        try:
            with open(file_path, 'rb') as f:
                files = {'file': f}
                data = {
                    'id': idpenerima,
                    'field': field_name,
                    'kontrak': idkontrak,
                    'prefik': prefix
                }
                r = self.session.post(url, data=data, files=files, timeout=60)
                res = r.json()
                return {"status": "success" if res.get('response') else "error", "message": res.get('message')}
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return {"status": "error", "message": str(e)}

    def register_recipient(self, data: dict):
        url = f"{self.base_url}/master/master_penerima/store"
        payload = {
            'dt[p_nik]': data.get('nik'),
            'dt[p_nama]': data.get('name'),
            'dt[tipe_kontrak]': 'Barang'
        }
        try:
            r = self.session.post(url, data=payload, timeout=30)
            logger.info(f"Registration result for {data.get('nik')}: {r.text}")
            # Successful registration or already exists (Duplicate) is considered okay for sync
            return {"status": "success" if "Success" in r.text or "Duplicate" in r.text else "error", "message": r.text}
        except Exception as e:
            return {"status": "error", "message": str(e)}

portal_service = PortalService()
