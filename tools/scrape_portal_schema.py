import asyncio
import json
import os
from playwright.async_api import async_playwright

async def scrape_schema():
    print("Starting Expert Schema Scraping...")
    
    if not os.path.exists("portal_session.json"):
        print("Error: No session file found.")
        return

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state="portal_session.json")
        page = await context.new_page()
        
        results = {"pages": [], "sitemap": []}
        
        # 1. Start at Dashboard
        print("Crawling Dashboard...")
        await page.goto("https://bastbanpem.pertanian.go.id/")
        await page.wait_for_load_state("networkidle")
        
        # Capture navigation sidebar
        nav_links = await page.eval_on_selector_all("a", "elements => elements.map(e => ({ text: e.innerText.trim(), href: e.href }))")
        results["sitemap"] = [l for l in nav_links if "pertanian.go.id" in l["href"] and "#" not in l["href"]]
        
        # 2. Recursive Scan of unique sections
        visited = set()
        to_visit = [l["href"] for l in results["sitemap"]][:15] # Limit depth for token safety
        
        for url in to_visit:
            if url in visited: continue
            visited.add(url)
            
            print(f"Analyzing Page: {url}")
            try:
                await page.goto(url, timeout=30000)
                await page.wait_for_load_state("domcontentloaded")
                
                # Extract Schema
                schema = await page.evaluate("""() => {
                    const getInputs = () => Array.from(document.querySelectorAll('input, select, textarea')).map(el => {
                        const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
                        return {
                            tag: el.tagName.toLowerCase(),
                            type: el.type || 'text',
                            name: el.name || '',
                            id: el.id || '',
                            label: label ? label.innerText.trim() : '',
                            placeholder: el.placeholder || '',
                            required: el.required,
                            options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => o.text) : []
                        };
                    });
                    
                    const getButtons = () => Array.from(document.querySelectorAll('button, .btn')).map(el => ({
                        text: el.innerText.trim(),
                        type: el.type || 'button',
                        action: el.onclick ? el.onclick.toString() : 'native'
                    }));

                    return {
                        title: document.title,
                        inputs: getInputs(),
                        buttons: getButtons()
                    };
                }""")
                
                results["pages"].append({
                    "url": url,
                    "schema": schema
                })
            except Exception as e:
                print(f"Failed to scrape {url}: {str(e)}")

        # Save to JSON
        with open("portal_schema.json", "w") as f:
            json.dump(results, f, indent=2)
        print("Schema data saved to portal_schema.json")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(scrape_schema())
