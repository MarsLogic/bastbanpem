import asyncio
import json
import os
from playwright.async_api import async_playwright

async def audit_all_detail_tabs():
    print("🚀 Starting Complete Detail Tab Exhaustion (BAST & Beyond)...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        detail_url = "https://bastbanpem.pertanian.go.id/Kontrak/detail/7395"
        results = {"tabs": {}}

        try:
            await page.goto(detail_url)
            await page.wait_for_load_state("networkidle")

            # Identify all tab names and their selectors
            tab_elements = page.locator(".nav-tabs a")
            tab_names = await tab_elements.all_inner_texts()
            print(f"Detected Tabs: {tab_names}")

            for name in tab_names:
                clean_name = name.strip()
                print(f"Auditing Tab: {clean_name}...")
                await page.click(f"text='{clean_name}'")
                await asyncio.sleep(3) # Wait for dynamic load

                # 1. Scrape Form Fields in this tab
                fields = await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('input, select, textarea, .form-control-static'))
                        .map(el => {
                            const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('.form-group')?.querySelector('label');
                            return {
                                label: label ? label.innerText.trim() : 'N/A',
                                name: el.name || el.id || 'N/A',
                                type: el.type || el.tagName.toLowerCase(),
                                val: el.value || el.innerText || '',
                                required: el.required || false
                            };
                        }).filter(f => f.label !== 'N/A' || f.name !== 'N/A');
                }""")

                # 2. Scrape Actions (Buttons) in this tab
                buttons = await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('button, a.btn'))
                        .map(b => ({
                            text: b.innerText.trim(),
                            type: b.type || 'link',
                            id: b.id,
                            action: b.onclick ? b.onclick.toString() : 'native'
                        })).filter(b => b.text.length > 0);
                }""")

                # 3. Detect Modals (if any button is clicked)
                # We'll look for "TAMBAH" or "GENERATE" buttons to probe
                tab_results = {"fields": fields, "buttons": buttons, "modals": []}
                
                results["tabs"][clean_name] = tab_results

            print("✅ All detail tabs audited.")

        except Exception as e:
            print(f"Audit Error: {str(e)}")

        with open("complete_detail_audit.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Audit data saved to complete_detail_audit.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(audit_all_detail_tabs())
