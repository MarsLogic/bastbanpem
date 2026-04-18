import asyncio
import json
import os
from playwright.async_api import async_playwright

async def final_template_mapping():
    print("🚀 Finalizing Template Schema Mapping...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        url = "https://bastbanpem.pertanian.go.id/Kontrak/detail/7395"
        
        try:
            print("Navigating to Rincian Penyaluran...")
            await page.goto(url)
            await page.click("text=RINCIAN PENYALURAN")
            await asyncio.sleep(2)

            # Click the EXACT button text
            print("Opening Import Modal...")
            await page.click("text=IMPORT PENERIMA DARI FILE EXCEL")
            await asyncio.sleep(2)

            # Extract Template Schema
            data = await page.evaluate("""() => {
                const modal = document.querySelector('.modal.show, .modal.in');
                const templateLink = modal?.querySelector('a[href*="template"]')?.href;
                const instructions = modal ? Array.from(modal.querySelectorAll('li, p')).map(li => li.innerText.trim()) : [];
                const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.innerText.trim());
                
                return {
                    template_link: templateLink,
                    instructions: instructions,
                    table_headers: headers
                };
            }""")
            
            # Save results
            with open("import_template_final.json", "w") as f:
                json.dump(data, f, indent=2)
            print("✅ Successfully captured final schema logic.")

        except Exception as e:
            print(f"Final Probe Error: {str(e)}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(final_template_mapping())
