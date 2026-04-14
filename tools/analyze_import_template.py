import asyncio
import json
import os
from playwright.async_api import async_playwright

async def analyze_import_template():
    print("🚀 Analyzing Import Template Logic (Rincian Penyaluran)...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        url = "https://bastbanpem.pertanian.go.id/kontrak/rincian_penyaluran_import/7395"
        results = {"url": url, "columns": [], "instructions": []}

        try:
            print(f"Navigating to {url}...")
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)

            # 1. Capture Column Map using more robust evaluation
            results["columns"] = await page.evaluate("""() => {
                const headerCells = Array.from(document.querySelectorAll('table thead th'));
                if (headerCells.length > 0) return headerCells.map(th => th.innerText.trim());
                return [];
            }""")

            # 2. Capture Filling Instructions (Petunjuk Pengisian) - Targeted search
            results["instructions"] = await page.evaluate("""() => {
                const selectors = ['.callout-info', '.alert-info', '.box-body', 'p'];
                for (let sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && (el.innerText.includes('Petunjuk') || el.innerText.includes('Excel'))) {
                        return Array.from(el.querySelectorAll('li, p')).map(li => li.innerText.trim());
                    }
                }
                return [];
            }""")

            # 3. Find Template Download Link - Fix Selector
            results["template_link"] = await page.evaluate("""() => {
                const links = Array.from(document.querySelectorAll('a'));
                const templateLink = links.find(a => 
                    a.href.includes('template') || 
                    a.innerText.toLowerCase().includes('download template') ||
                    a.innerText.toLowerCase().includes('unduh template')
                );
                return templateLink ? templateLink.href : null;
            }""")

            # 4. Map the Import Form (where they upload the file)
            results["import_form"] = await page.evaluate("""() => {
                const importBtn = document.querySelector('input[type="file"]');
                const form = importBtn ? importBtn.closest('form') : null;
                if (!form) return null;
                return {
                    action: form.action,
                    fields: Array.from(form.querySelectorAll('input, select')).map(i => ({
                        name: i.name,
                        type: i.type,
                        id: i.id,
                        label: document.querySelector(`label[for="${i.id}"]`)?.innerText.trim() || ''
                    }))
                };
            }""")

            await page.screenshot(path="import_template_debug_v2.png")

        except Exception as e:
            print(f"Template Analysis Error: {str(e)}")

        with open("import_template_schema.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Schema saved to import_template_schema.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(analyze_import_template())
