# ARCHITECTURE_SOTA.md - The BAST-Automator Logic

## Philosophy: Smart Visual Workbench

Unlike standard automation tools that rely solely on OCR (which often fails with poor government scans), BAST-Automator uses the **Human-in-the-loop Triage** model.

1. **High-Speed Slicing**: Bulk load 500-page PDFs into memory using Rust/Tauri.
2. **Visual Verification**: Display thumbnails and crops immediately.
3. **Manual Override**: If the system suggests "Page 45 is Recipient X", the human eyes confirm with a single click/hotkey.
4. **No Slow OCR**: Prioritize coordinate-based cropping and metadata extraction from Excel over heavy image processing.

---

## The Tech Stack Bridge

### 1. Internal WebView Injection
We do **not** use Chrome Extensions. Instead:
- Tauri manages an internal `WebView`.
- We use the `window.eval()` or Tauri's `IPC` to inject scripts into the government portal DOM.
- The `WebView` acts as a child window, allowing our local Dashboard to drive the portal like a puppeteer.

### 2. Security & Port Protection
- **Port 59876**: Fixed to prevent conflicts with other dev tools or local services.
- This port is hardcoded into the Tauri configuration to ensure the internal Vite server always binds correctly.

### 3. Data Integrity (The Math)
- **Decimal.js**: Used in the frontend for all currency and quantity calculations. 
- **Rule**: `Total Value == SUM(Recipient Values)`. If `Selisih != 0`, the "Ready for Injection" status is blocked.

---

## Communication Flow
1. **Frontend (Dashboard)**: User creates mapping.
2. **Backend (Tauri/Rust)**: Slices PDF and saves to local temporary storage.
3. **Bridge (Injection)**: Tauri sends JSON data packet to the Bridge script.
4. **DOM (Government Portal)**: Bridge script fills input fields and clicks "Submit".
