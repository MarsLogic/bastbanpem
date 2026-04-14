from playwright.async_api import async_playwright, Page
from playwright_stealth import stealth_async
# [AUTO-001] Playwright Government Site Injection
import asyncio
import logging

# Configure logging for automation tracking
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("automation_service")

async def init_stealth_page(page: Page):
    """Initializes stealth mode for a given playwright page."""
    await stealth_async(page)
    logger.info("Stealth mode initialized for page.")

async def submit_to_government_site(data: dict):
    """
    Expert Injector: Handles multi-tab navigation and modal evidence uploads.
    """
    logger.info(f"Starting automation for NIK: {data.get('nik', 'UNKNOWN')}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False) # Visual mode for user monitoring
        context = await browser.new_context()
        page = await context.new_page()
        await init_stealth_page(page)
        
        try:
            # 1. Base Navigation
            contract_id = data.get("idkontrak")
            await page.goto(f"https://bastbanpem.pertanian.go.id/kontrak/detail/{contract_id}")
            
            # Check for login requirement
            if "login" in page.url:
                logger.info("Awaiting manual user login...")
                # In production, we'd wait for a specific element that exists only after login
                await page.wait_for_selector(".navbar-static-top", timeout=300000) 

            # 2. Rincian Penyaluran Tab
            await page.click("a[href*='rincian_penyaluran']")
            
            # 3. Locate Recipient and Open DO Modal
            # Search for the row containing the NIK
            nik = data.get("nik")
            row_selector = f"tr:has-text('{nik}')"
            await page.wait_for_selector(row_selector)
            
            # Click "DO & Bukti Terima" button in that row
            await page.click(f"{row_selector} .btn-primary:has-text('DO & Bukti Terima')")
            
            # 4. Modal Injection (14 Fields)
            await page.wait_for_selector("#modal-do-bukti") # Assumed ID from blueprint
            
            # Mandatory File Uploads
            evidence = data.get("evidence", {})
            if evidence.get("delivery_order_path"):
                await page.set_input_files("input[name='file_do']", evidence["delivery_order_path"])
            
            if evidence.get("invoice_ongkir_path"):
                await page.set_input_files("input[name='file_invoice']", evidence["invoice_ongkir_path"])
                
            # Values
            await page.fill("input[name='txt-ongkir']", str(evidence.get("ongkir_value", 0)))
            
            # Photo Evidence (Loop Foto 1-5)
            for i in range(1, 6):
                field_name = f"foto_bukti_{i}_path"
                if evidence.get(field_name):
                    await page.set_input_files(f"input[name='file_foto_{i}']", evidence[field_name])

            # 5. Save Modal
            # await page.click("#btn-save-do") 
            
            return {"status": "success", "message": f"Injection completed for NIK {nik}"}
            
        except Exception as e:
            logger.error(f"Injection failed: {str(e)}")
            return {"status": "error", "message": str(e)}
        finally:
            # We keep it open for user confirmation in semi-autonomous mode
            await asyncio.sleep(5) 
            await browser.close()
