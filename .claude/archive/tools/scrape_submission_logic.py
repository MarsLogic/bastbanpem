import asyncio
import json
import os
from playwright.async_api import async_playwright

async def scrape_tabs_and_modals():
    print("🔍 Deep Scanning Tabs for Submission Logic...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        with open("deep_dive_kontrak.json", "r") as f:
            deep_data = json.load(f)
        
        detail_url = deep_data.get("detail_schema", {}).get("url")
        results = {"tabs": []}

        try:
            await page.goto(detail_url)
            await page.wait_for_load_state("networkidle")

            # Find all tab links
            tab_selectors = [".nav-tabs a", "[data-toggle='tab']", ".tab-link"]
            tabs = []
            for sel in tab_selectors:
                elements = page.locator(sel)
                if await elements.count() > 0:
                    for i in range(await elements.count()):
                        tabs.append({
                            "text": await elements.nth(i).inner_text(),
                            "locator": elements.nth(i)
                        })
                    break

            print(f"Found {len(tabs)} tabs. Scanning each...")

            for tab in tabs:
                tab_name = tab["text"].strip()
                print(f"Entering Tab: {tab_name}...")
                await tab["locator"].click()
                await asyncio.sleep(2) # Wait for tab content

                # Capture buttons in this tab
                actions = await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('button, a.btn')).map(b => ({
                        text: b.innerText.trim(),
                        id: b.id,
                        class: b.className
                    })).filter(b => b.text.length > 0);
                }""")

                tab_info = {"name": tab_name, "actions": actions, "modals": []}

                # Try clicking any "Tambah" or "Import" button in this tab
                for action in actions:
                    if any(k in action["text"].upper() for k in ["TAMBAH", "IMPORT", "UNGGAH"]):
                        print(f"  Probing Action: {action['text']}...")
                        try:
                            # Use locator based on text to be safe
                            await page.locator(f"button:has-text('{action['text']}'), a:has-text('{action['text']}')").first.click()
                            await asyncio.sleep(2)

                            modal_schema = await page.evaluate("""() => {
                                const modal = document.querySelector('.modal.show, .modal.in, #modal-form, #modal-import');
                                if (!modal) return null;
                                return {
                                    title: modal.querySelector('.modal-title')?.innerText.trim(),
                                    fields: Array.from(modal.querySelectorAll('input, select, textarea')).map(el => ({
                                        label: document.querySelector(`label[for="${el.id}"]`)?.innerText.trim() || el.name,
                                        name: el.name,
                                        type: el.type,
                                        required: el.required,
                                        options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => o.text) : []
                                    }))
                                };
                            }""")
                            if modal_schema:
                                tab_info["modals"].append(modal_schema)
                                print(f"  ✅ Captured Modal: {modal_schema['title']}")
                            
                            await page.keyboard.press("Escape")
                            await asyncio.sleep(1)
                        except:
                            print(f"  ❌ Failed to trigger {action['text']}")

                results["tabs"].append(tab_info)

        except Exception as e:
            print(f"Scan Error: {str(e)}")

        with open("submission_logic_v2.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Logic scan v2 saved.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_tabs_and_modals())
