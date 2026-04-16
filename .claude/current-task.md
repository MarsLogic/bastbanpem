# Task: Fix PDF Auto-Fill Not Working

## Context
**Issue:** User uploaded PDF in Master PDF Sync section (red), but fields in blue section (Administrative/Contract Info/Financials) not auto-filling

**Expected:** Click "Run AI Scan" → PDF analyzed → Fields populate with extracted data

**What's happening:** PDF uploaded but no auto-population

## Investigation Questions
1. Is "Run AI Scan" button being clicked?
2. Is backend PDF parsing working? (parsePdf API endpoint)
3. Are extracted fields being returned from backend?
4. Are React state updates working properly?

## Blue Section (Data Source)
The blue section shows contract metadata that should be populated by:
1. PDF upload → user selects file
2. "Run AI Scan" button → calls `parsePdf()` API
3. Backend extracts: nomorKontrak, tanggalKontrak, namaPemesan, namaPenyedia, namaProduk, totalPembayaran
4. Data returns and updates Master Metadata fields

## Current Flow (Post-Refactor)
- ✅ File upload works (replaced Tauri with HTML input)
- ❓ "Run AI Scan" button behavior unknown
- ❓ Backend PDF parsing status unclear
- ❓ State updates working?

## To Debug
1. Check if "Run AI Scan" button is clickable/functional
2. Check browser console for errors when clicking "Run AI Scan"
3. Verify backend parsePdf endpoint is running
4. Check if API response contains extracted data
