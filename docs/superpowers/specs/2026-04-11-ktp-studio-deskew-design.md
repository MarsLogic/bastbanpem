# Spec: KTP Command Center & Precision Quad Deskew

**Status:** Draft
**Topic:** UI/UX Overhaul & Advanced Perspective Correction
**Date:** 2026-04-11

---

## 1. Objective
Transform the KTP Tagging module into a professional "Studio" environment that prioritizes an unobstructed viewport, expert-grade editing tools (Perspective/Quad Deskew), and seamless AI binding to Excel data.

## 2. Design Architecture

### 2.1 The "Spacious Studio" Layout
- **Canvas-First Viewport:** A large, dark-themed central area for image inspection. All floating UI must have high transparency (blur-behind) and be positioned at edges to avoid obscuring the standard KTP text layout.
- **Top Action Bar:**
    - Primary Action: **AI SCAN (Incremental/Unbound)** with scope dropdown.
    - Secondary Action: **Change Source Folder**.
- **Floating Editor Toolbar (Top-Center):**
    - Large, high-contrast buttons for **Crop**, **Rotate 90°**, and **Quad Deskew**.
    - Urgent Action: **REVERT TO ORIGINAL** (Red, bold).
- **Expert Side Panel (Right):**
    - High-density search for **Excel Data (Section 2)**.
    - Result cards showing Name, NIK, and village with a prominent **BIND** toggle.
- **Horizontal Filmstrip (Bottom):**
    - Fast navigation between local images.
    - Visual indicators for "Tagged" (Checkmark) and "Edited" (Badge).

### 2.2 Precision Quad Deskew (3D Flattening)
- **4-Point Mapping:** User defines the four corners of the KTP card by dragging handles on the canvas.
- **Perspective Transform:** Implementation of a Homography warp to "flatten" the card into a standard aspect ratio.
- **Visual Feedback:** 
    - Real-time dashed outline connecting the 4 points.
    - Magnified loupe at corners during drag for pixel-perfect placement.
- **Persistence:** Flattened images are saved as versioned edited files (`_edited_{timestamp}`) to ensure non-destructive workflow.

## 3. Data Flow & Integration

### 3.1 AI Scan Logic (PaddleOCR Bridge)
- **Target:** The AI Scan specifically attempts to extract a **16-digit NIK** from the image.
- **Matching:** Extracted NIK is cross-referenced against the **Excel Recipient List (Section 2)**.
- **Auto-Bind:** If a match is found, the image is automatically bound to that recipient without manual search.
- **Optimization:** Users can run "Scan Unbound" to only process images that haven't been tagged yet.

### 3.2 Global State Synchronization
- Bindings created in the Studio immediately update the **Distribution Workbench** and **Document Slicer** sidebar status indicators (Checkmarks).

---

## 4. Success Criteria
- [ ] User can view the entire KTP without any UI buttons covering the text.
- [ ] 4-point perspective transform successfully flattens images taken at an angle.
- [ ] AI Scan correctly binds an image to an Excel row if the NIK matches.
- [ ] "Revert to Original" cleanly deletes edited files and restores original tags.
