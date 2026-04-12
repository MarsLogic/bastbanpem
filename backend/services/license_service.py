import os
import json
import base64
import hashlib
from datetime import datetime
from cryptography.fernet import Fernet
from backend.services.hardware_orchestrator import HardwareOrchestrator

class LicenseService:
    def __init__(self):
        # In a real app, this key would be stored securely or derived
        self.secret_key = b'ELITE_BAST_SECRET_KEY_PROD_2026_04_11=' 
        self.cipher = Fernet(base64.urlsafe_b64encode(hashlib.sha256(self.secret_key).digest()))
        self.license_path = "license.lic"

    def get_machine_id(self) -> str:
        """
        Derive a unique Hybrid ID for this PC.
        """
        caps = HardwareOrchestrator.get_system_capabilities()
        raw = f"{caps['is_intel']}_{caps['total_ram_gb']}_{os.cpu_count()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def validate_license(self) -> dict:
        """
        Elite Validation: Checks file existence, decryption, HWID, and expiry.
        """
        if not os.path.exists(self.license_path):
            return {"status": "unlicensed", "message": "License file missing"}

        try:
            with open(self.license_path, "rb") as f:
                encrypted_data = f.read()
            
            decrypted = self.cipher.decrypt(encrypted_data)
            data = json.loads(decrypted)
            
            # 1. Hardware Check
            machine_id = self.get_machine_id()
            if data.get("hwid") != "UNIVERSAL" and data.get("hwid") != machine_id:
                return {"status": "invalid", "message": "Hardware mismatch (Locked to another PC)"}
            
            # 2. Expiry Check
            expiry = datetime.strptime(data.get("expiry"), "%Y-%m-%d")
            if datetime.now() > expiry:
                return {"status": "expired", "message": f"License expired on {data.get('expiry')}"}
            
            return {"status": "active", "data": data}
            
        except Exception as e:
            return {"status": "error", "message": f"License corruption: {str(e)}"}

    def generate_license_token(self, name: str, expiry: str, hwid: str = "UNIVERSAL") -> str:
        """
        Admin Helper: Generate a new encrypted license string.
        """
        payload = {
            "owner": name,
            "expiry": expiry,
            "hwid": hwid,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        return self.cipher.encrypt(json.dumps(payload).encode()).decode()

if __name__ == "__main__":
    # Test generation
    svc = LicenseService()
    my_hwid = svc.get_machine_id()
    token = svc.generate_license_token("Premium User", "2027-01-01", hwid=my_hwid)
    print(f"Generated Token: {token}")
    
    # Test validation
    with open("license.lic", "wb") as f:
        f.write(token.encode())
    print(f"Validation: {svc.validate_license()}")
