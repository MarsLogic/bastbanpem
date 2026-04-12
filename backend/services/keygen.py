import os
import sys
from datetime import datetime, timedelta
from backend.services.license_service import LicenseService

def run_keygen():
    svc = LicenseService()
    print("====================================================")
    print("   BASTBANPEM AUTOMATOR - MASTER LICENSE GENERATOR")
    print("====================================================")
    
    # 1. Owner Name
    name = input("\nEnter Client/Owner Name: ").strip()
    if not name:
        print("Error: Owner name is required.")
        return

    # 2. Expiry Strategy
    print("\nChoose Expiry Strategy:")
    print("[1] 1 Month (Fast trial)")
    print("[2] 1 Year (Standard Professional)")
    print("[3] Custom Date (YYYY-MM-DD)")
    
    choice = input("Choice [1-3]: ")
    if choice == "1":
        expiry = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    elif choice == "2":
        expiry = (datetime.now() + timedelta(days=365)).strftime("%Y-%m-%d")
    else:
        expiry = input("Enter Expiry Date (YYYY-MM-DD): ").strip()

    # 3. Hardware Locking
    print("\nChoose Lock Mode:")
    print("[1] UNIVERSAL (Works on any PC - use for internal/VIP)")
    print("[2] HWID-LOCKED (Enter client's specific Hardware ID)")
    
    lock_choice = input("Choice [1-2]: ")
    hwid = "UNIVERSAL"
    if lock_choice == "2":
        hwid = input("Enter Client HWID: ").strip()
        if not hwid:
            print("Error: HWID required for locked mode.")
            return

    # 4. Generation
    print("\nGenerating Elite Encrypted Token...")
    token = svc.generate_license_token(name, expiry, hwid)
    
    filename = f"license_{name.replace(' ', '_')}.lic"
    with open(filename, "w") as f:
        f.write(token)
        
    print(f"\n[SUCCESS] License Provisioned Successfully!")
    print(f"File: {filename}")
    print(f"Owner: {name}")
    print(f"Expiry: {expiry}")
    print(f"Lock: {hwid}")
    print("----------------------------------------------------")

if __name__ == "__main__":
    run_keygen()
