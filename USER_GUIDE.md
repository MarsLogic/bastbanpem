# BAST-Automator 2025: Admin User Guide

Welcome to the **BAST-Automator 2025**. This tool is designed to simplify the BAST (Berita Acara Serah Terima) process for the BANPEM program, ensuring 100% data accuracy and zero-conflict file injection into the government portal.

## 🌟 The "Golden Workflow" (5-Step Checklist)

Follow these steps to complete a batch transmission:

1. **Ingest & Audit:** 
   - Drag and drop your Master Excel file. 
   - The system will automatically normalize headers, validate NIKs, and check for math discrepancies. Ensure the "Selisih" is `0`.

2. **Global Setting:** 
   - Set the Lab Testing Agency and Certificate metadata once in the **Global Settings** panel. 
   - Use "Pin to All" to propagate this data to every recipient.

3. **Visual Slicing (Workbench):** 
   - Use the **Slicer Workspace** to extract Surat Jalan (SJ) and Photos from your combined PDF/JPG source files.
   - Files are automatically saved to the portable `App_Data` folder.

4. **Pre-Flight Health Check:** 
   - Click the **Check Readiness** button. 
   - Ensure all recipients show the green `READY` indicator (SJ, Photo, Global, and Math are all green).

5. **Magic Auto-Fill:** 
   - Click **🚀 Launch Portal**.
   - Navigate to the specific recipient's detail page.
   - The **🚀 VENDOR ASSIST** panel will appear. Click **Inject Data** to automatically fill forms and upload sliced files from your `App_Data` folder.

---

## 🛠️ Maintenance & Portability

- **Zero Dependency:** This app is a standalone `.exe`. Just move the folder anywhere.
- **Data Persistence:** All your work is saved in the `App_Data` folder. Do **not** delete this folder if you want to resume work later.
- **Port Conflict:** If the default port `59876` is used by another app, the system will automatically find the next available port. No configuration required.

## 🚀 Troubleshooting

- **Portal not detecting data?** Ensure the government portal URL is exactly `https://bastbanpem.pertanian.go.id`.
- **Files failing to upload?** Check if the files still exist in the `App_Data` folder. The app requires these files to be present during injection.

---
*Created by Senior Full-Stack Engineer (Build & Deployment Specialist)*
