from playwright.async_api import async_playwright, Page
from playwright_stealth import stealth_async
import asyncio
import logging
import os

# [AUTO-001] Playwright Government Site Injection Engine
# Specialized for BASTB, Surat Jalan, and Evidence Uploads

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automation_service")

async def init_stealth_page(page: Page):
    """Initializes stealth mode for a given playwright page."""
    await stealth_async(page)
    logger.info("Stealth mode initialized for automated session.")

async def submit_to_government_site(data: dict):
    """
    Expert Injector: Handles multi-tab navigation and modal evidence uploads (BASTB/SJ/Photos).
    """
    logger.info(f"Starting automation for NIK: {data.get('nik', 'UNKNOWN')}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await init_stealth_page(page)
        
        try:
            # 1. Base Navigation
            contract_id = data.get("idkontrak")
            if not contract_id:
                return {"status": "error", "message": "idkontrak is missing"}

            await page.goto(f"https://bastbanpem.pertanian.go.id/kontrak/detail/{contract_id}")
            
            # 2. Authentication Check
            if "login" in page.url:
                logger.info("Awaiting manual user authentication...")
                # Wait for main portal navigation element to appear post-login
                await page.wait_for_selector(".navbar-static-top", timeout=300000) 

            # 3. Navigate to RPB / Penyaluran Tab
            await page.click("a[href*='rincian_penyaluran']")
            
            # 4. Locate Recipient Row
            nik = data.get("nik")
            row_selector = f"tr:has-text('{nik}')"
            try:
                await page.wait_for_selector(row_selector, timeout=10000)
            except:
                return {"status": "error", "message": f"Recipient NIK {nik} not found on current page"}
            
            # 5. Open DO & Bukti Modal
            await page.click(f"{row_selector} .btn-primary:has-text('DO & Bukti Terima')")
            await page.wait_for_selector("#modal-do-bukti")
            
            # 6. High-Fidelity Injection for Document Uploads
            evidence = data.get("evidence", {})
            
            # Mapping local paths to portal modal inputs
            upload_map = [
                ("delivery_order_path", "file_do", "Delivery Order"),
                ("surat_jalan_path", "file_surat_jalan", "Surat Jalan"),
                ("bastb_path", "file_bastb", "BASTB"),
                ("invoice_ongkir_path", "file_invoice", "Invoice Ongkir")
            ]

            for local_key, input_name, label in upload_map:
                file_path = evidence.get(local_key)
                if file_path and os.path.exists(file_path):
                    logger.info(f"Injecting {label}: {file_path}")
                    await page.set_input_files(f"input[name='{input_name}']", file_path)
            
            # 7. Metadata Injection (Numeric Fields)
            if evidence.get("ongkir_value"):
                await page.fill("input[name='txt-ongkir']", str(evidence["ongkir_value"]))
            
            # 8. Sequential Photo Injection (Foto 1-5)
            for i in range(1, 6):
                field_key = f"foto_bukti_{i}_path"
                file_path = evidence.get(field_key)
                if file_path and os.path.exists(file_path):
                    logger.info(f"Injecting Evidence Photo {i}: {file_path}")
                    await page.set_input_files(f"input[name='file_foto_{i}']", file_path)

            # 9. Commit Changes (Optional: user confirmation usually preferred in semi-autonomous)
            # await page.click("#btn-save-do") 
            
            logger.info(f"Injection successfully completed for NIK: {nik}")
            return {"status": "success", "message": f"Automation payload delivered for NIK {nik}"}
            
        except Exception as e:
            logger.error(f"Automation sequence failed: {str(e)}")
            return {"status": "error", "message": str(e)}
        finally:
            # Maintain browser state briefly for user verification
            await asyncio.sleep(5) 
            await browser.close()
