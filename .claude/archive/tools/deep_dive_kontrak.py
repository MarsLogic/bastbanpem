import asyncio
import json
import os
import re
from playwright.async_api import async_playwright

async def find_active_contract():
    print("🚀 Expert Search for Active Contracts...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        results = {"detail_schema": {}}
        
        try:
            print("Navigating to List Kontrak...")
            await page.goto("https://bastbanpem.pertanian.go.id/kontrak/listkontrakvendor")
            await page.wait_for_load_state("networkidle")

            # Try to find ANY Eselon that has data by brute force scanning top options
            eselon_indices = [1, 2, 3, 4, 5, 6] # Try top 6 eselons
            
            for e_idx in eselon_indices:
                print(f"Trying Eselon index {e_idx}...")
                await page.select_option("#sel-eselon", index=e_idx)
                await asyncio.sleep(2)
                
                # Check if table automatically populated (sometimes it does for some Eselons)
                # If not, click filter with "Semua Satker"
                await page.click("button:has-text('FILTER')")
                await asyncio.sleep(4)
                
                detail_links = await page.eval_on_selector_all("a", """links => 
                    links.filter(a => a.href.includes('/kontrak/detail/') || a.querySelector('.fa-eye'))
                         .map(a => a.href)
                """)
                
                if detail_links:
                    print(f"✅ Data found at Eselon {e_idx}!")
                    await page.goto(detail_links[0])
                    await page.wait_for_load_state("networkidle")
                    await asyncio.sleep(3)
                    
                    results["detail_schema"] = await page.evaluate("""() => {
                        const scrapeTables = () => Array.from(document.querySelectorAll('table')).map(t => ({
                            id: t.id,
                            headers: Array.from(t.querySelectorAll('th')).map(th => th.innerText.trim()),
                            rows: Array.from(t.querySelectorAll('tbody tr')).slice(0, 5).map(tr => 
                                Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
                            )
                        }));

                        const scrapeTabs = () => Array.from(document.querySelectorAll('.nav-tabs a, [data-toggle="tab"]')).map(a => ({
                            text: a.innerText.trim(),
                            id: a.getAttribute('href') || a.getAttribute('data-target')
                        }));

                        return {
                            url: window.location.href,
                            title: document.title,
                            tabs: scrapeTabs(),
                            tables: scrapeTables(),
                            fields: Array.from(document.querySelectorAll('label')).map(l => ({
                                label: l.innerText.trim(),
                                val: l.nextElementSibling?.innerText.trim() || l.parentElement?.innerText.trim()
                            })).filter(f => f.label && f.label.length < 50)
                        };
                    }""")
                    break
                else:
                    print(f"No data for Eselon {e_idx}.")

        except Exception as e:
            print(f"Error: {str(e)}")
        
        with open("deep_dive_kontrak.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Results saved.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(find_active_contract())
