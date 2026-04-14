import asyncio
import json
import os
import re
from playwright.async_api import async_playwright

async def harvest_satker_links():
    print("🚀 Harvesting Google Drive links from Satker Notes...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        url = "https://bastbanpem.pertanian.go.id/Kontrak/detail/7395"
        results = {"drive_links": [], "notes_text": []}

        try:
            await page.goto(url)
            await page.wait_for_load_state("networkidle")

            # 1. Navigate to 'CATATAN DARI SATKER'
            print("Entering Satker Notes Tab...")
            await page.click("text='CATATAN DARI SATKER'")
            await asyncio.sleep(3)

            # 2. Extract all Google Drive Links
            links = await page.eval_on_selector_all("a", """links => 
                links.filter(a => a.href.includes('drive.google.com') || a.href.includes('docs.google.com'))
                     .map(a => ({ text: a.innerText.trim(), href: a.href }))
            """)
            results["drive_links"] = links
            print(f"Found {len(links)} Google Drive links.")

            # 3. Capture full notes text for context (often contains passwords or instructions)
            notes = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('.box-body, .timeline-item, td'))
                    .map(el => el.innerText.trim())
                    .filter(t => t.length > 20);
            }""")
            results["notes_text"] = notes

        except Exception as e:
            print(f"Harvest Error: {str(e)}")

        with open("satker_notes_audit.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Audit data saved.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(harvest_satker_links())
