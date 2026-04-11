# BAST-Automator 2026: Administrative Audit Engine
**Internal State & Intelligence Context**

This document serves as the "Long-Term Memory" for AI agents and developers working on the BAST-Automator. It details the technical architecture, recent breakthroughs, and current friction points.

---

## 🛠️ Technology Stack
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | High-performance UI with HMR. |
| **Native** | Tauri v2 | Secure local file access & PDF processing. |
| **Logic** | TypeScript + decimal.js | Exact financial math & reconciliation. |
| **Testing** | Vitest | Fast unit testing for parsers. |
| **Styling** | Tailwind CSS v4 | Rapid UI construction with Geist fonts. |
| **Storage** | LocalForage | Persistence across app restarts. |

---

## 🎯 Current Objectives & Methodology
The project has evolved from a simple tagger to a **Reconciliation Engine**. The primary goal is to verify that the **Contract PDF** matches the **Distribution Excel** with 100% accuracy before injection into government portals.

### The "Dual-Pane Audit" Pattern
Used for complex contract sections (SSKK, Technical Specs):
- **Left Pane**: PDF Viewer locked to physical page ranges (evidence).
- **Right Pane**: Professionally formatted text/table view (audit data).
- **Export Trigger**: Ability to slice specific pages as a separate PDF "Evidence Slide".

---

## ✅ Recent Breakthroughs (Session History)

### 1. High-Accuracy PDF Pattern Learner (April 2026)
- **Breakthrough**: Finalized research script `pdf_pattern_learner.py` achieved 100% metadata accuracy across 88 sample PDFs.
- **Ported**: Logic bridged into `src/lib/pdfContractParser.ts`. It now handles complex Date/Time formats and multi-stage delivery blocks reliably.
- **Page-Aware**: The system now automatically identifies the exact page ranges for SSKK and Technical Specs.

### 2. Audit & Reconciliation Engine
- **Engine**: Created `auditEngine.ts` which performs fuzzy name matching (recipient names) and quantity cross-checks.
- **UI**: Added a dedicated "Audit & Reconciliation" section in the dashboard with a "Integrity Score".
- **Evidence**: Integrated "Evidence Slicing" into the audit view, allowing users to see the PDF source alongside the Excel row data.

### 3. Superpowers Workflow Integration
- **Framework**: `obra/superpowers` installed. Established a strict Brainstorming -> Spec -> Plan -> Execute workflow.
- **Artifacts**: New specifications and implementation plans now live in `docs/superpowers/`.

### 4. Excel "Magic Balance" Reconciliation
- **Breakthrough**: Solved the "Rounding Gap" problem where DPP + PPN sums didn't match the grand total due to decimal precision.
- **Solution**: Implemented `applyMagicBalance` using `decimal.js` to automatically absorb 1-2 unit discrepancies into the largest transaction.

---

## 🚧 Current Challenges & Pending Tasks

### 🔴 Cross-Sheet NIK Deduplication
- **Status**: Simple per-sheet duplicate detection exists.
- **Goal**: Implement a global "Duplicate Hive" that flags NIKs appearing across different Excel sheets or previous contract uploads to prevent double-distribution.

### 🔴 Injection Verification Gates
- **Status**: Injection is triggered manually.
- **Goal**: Enforce a "Hard Block" on injection if any row in the Excel Matrix has an active sync gap or missing KTP evidence.

### 🔴 Automated PDF Evidence Slicing
- **Status**: Manual export available.
- **Goal**: Automated generation of an "Audit Bundle" — a single PDF containing the Audit Report followed by the extracted evidence pages for every recipient.

---

## 📜 Operating Rules for AI Agents
1. **Never use standard Float**: Always use `Decimal` for anything involving `CalculatedValue` or `TargetValue`.
2. **Offline-First Integrity**: Do not attempt to use external OCR APIs; stick to `pdfjs` text layer extraction.
3. **Typography Matters**: Legal documents must be in **Serif** fonts with generous line heights (`leading-[1.8]`).
4. **Superpowers**: Always create a Spec and Plan in `docs/superpowers/` before starting a new major feature.
