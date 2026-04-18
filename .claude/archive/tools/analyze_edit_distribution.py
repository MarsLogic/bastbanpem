import asyncio
import json
import os
from playwright.async_api import async_playwright

async def analyze_edit_distribution():
    print("🚀 Analyzing Distribution Edit Page (Titik Bagi)...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        url = "https://bastbanpem.pertanian.go.id/kontrak/detail-edit/7395"
        results = {"url": url, "import_schema": {}, "titik_bagi_fields": []}

        try:
            print(f"Navigating to {url}...")
            await page.goto(url)
            await page.wait_for_load_state("networkidle")
            await asyncio.sleep(2)

            # 1. Capture Page Schema
            results["page_info"] = await page.evaluate("""() => {
                return {
                    title: document.title,
                    headers: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText.trim()),
                    instructions: Array.from(document.querySelectorAll('.alert, .callout, p')).map(p => p.innerText.trim()).filter(t => t.includes('Excel') || t.includes('Titik'))
                };
            }""")

            # 2. Probe the "Import Excel" button/modal
            import_trigger = page.locator("button:has-text('Import'), .btn-import, #btn-import")
            if await import_trigger.count() > 0:
                print("Triggering Import Modal...")
                await import_trigger.first.click()
                await asyncio.sleep(2)
                
                results["import_schema"] = await page.evaluate("""() => {
                    const modal = document.querySelector('.modal.show, .modal.in, #modal-import');
                    if (!modal) return { error: "Modal not detected" };
                    
                    return {
                        title: modal.querySelector('.modal-title')?.innerText.trim(),
                        fields: Array.from(modal.querySelectorAll('input, select')).map(el => ({
                            label: document.querySelector(`label[for="${el.id}"]`)?.innerText.trim() || el.name,
                            name: el.name,
                            type: el.type,
                            id: el.id
                        })),
                        download_template_link: modal.querySelector('a[href*="template"]')?.href || null
                    };
                }""")
                await page.keyboard.press("Escape")

            # 3. Capture the Data Grid (Titik Bagi Table)
            print("Mapping Titik Bagi Data Grid...")
            results["titik_bagi_grid"] = await page.evaluate("""() => {
                const table = document.querySelector('table');
                if (!table) return null;
                return {
                    headers: Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim()),
                    sample_row: Array.from(table.querySelectorAll('tbody tr')).slice(0, 2).map(tr => 
                        Array.from(tr.querySelectorAll('td')).map(td => ({
                            text: td.innerText.trim(),
                            has_input: td.querySelector('input') !== null,
                            input_name: td.querySelector('input')?.name || null
                        }))
                    )
                };
            }""")

            await page.screenshot(path="distribution_edit_debug.png")

        except Exception as e:
            print(f"Analysis Error: {str(e)}")

        with open("distribution_edit_schema.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Schema saved to distribution_edit_schema.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(analyze_edit_distribution())
