import asyncio
import os
from playwright.async_api import async_playwright

async def capture_session():
    print("Opening browser for manual login...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        await page.goto("https://bastbanpem.pertanian.go.id/login")
        
        print("Waiting for login to complete (detected by URL change)...")
        # Wait for any URL that isn't login or is a dashboard-like path
        try:
            # Common paths after login: /, /home, /Dashboard, /Kontrak
            await page.wait_for_url(lambda url: "login" not in url, timeout=300000) # 5 min timeout
            print("Login detected! Saving session state...")
            await asyncio.sleep(2) # Wait for cookies to settle
            
            state_path = "portal_session.json"
            await context.storage_state(path=state_path)
            print(f"Session successfully saved to {state_path}")
        except Exception as e:
            print(f"Capture failed or timed out: {str(e)}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(capture_session())
