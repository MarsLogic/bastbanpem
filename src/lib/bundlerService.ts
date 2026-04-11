/**
 * bundlerService.ts
 *
 * Handles generating consolidated PDF evidence bundles for audit compliance.
 * Merges Audit Reports, Sliced Contract PDF pages, and Local Images.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';
import { ContractData } from './contractStore';
import { ExcelRow } from './excelParser';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * Generates a single consolidated PDF for one recipient.
 */
export async function generateRecipientBundle(
  contract: ContractData,
  recipient: ExcelRow,
  masterPdfBytes: Uint8Array,
  ktpBytes?: Uint8Array,
  proofBytes?: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  // --- PAGE 1: AUDIT COVER ---
  const coverPage = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = coverPage.getSize();

  // Header
  coverPage.drawText('ADMINISTRATIVE AUDIT EVIDENCE BUNDLE', {
    x: 50, y: height - 50, size: 18, font: timesBoldFont
  });
  
  coverPage.drawLine({
    start: { x: 50, y: height - 65 },
    end: { x: width - 50, y: height - 65 },
    thickness: 2,
    color: rgb(0, 0, 0)
  });

  // Metadata Table
  const drawRow = (label: string, value: string, y: number) => {
    coverPage.drawText(label, { x: 50, y, size: 10, font: timesBoldFont, color: rgb(0.4, 0.4, 0.4) });
    coverPage.drawText(value || 'N/A', { x: 200, y, size: 11, font: timesRomanFont });
  };

  let yPos = height - 100;
  drawRow('CONTRACT NO', contract.nomorKontrak, yPos); yPos -= 25;
  drawRow('CONTRACT DATE', contract.tanggalKontrak, yPos); yPos -= 25;
  drawRow('RECIPIENT NAME', recipient.name, yPos); yPos -= 25;
  drawRow('NIK (ID)', recipient.nik, yPos); yPos -= 25;
  drawRow('QUANTITY', `${recipient.qty} Unit`, yPos); yPos -= 25;
  drawRow('LOCATION', `${recipient.kecamatan}, ${recipient.kabupaten}`, yPos); yPos -= 40;

  // Audit Status
  coverPage.drawText('AUDIT VERIFICATION STATUS', { x: 50, y: yPos, size: 12, font: timesBoldFont });
  yPos -= 20;
  const isSynced = recipient.isSynced;
  coverPage.drawRectangle({
    x: 50, y: yPos - 15, width: 500, height: 30,
    color: isSynced ? rgb(0.9, 1, 0.9) : rgb(1, 0.9, 0.9),
    borderColor: isSynced ? rgb(0, 0.5, 0) : rgb(0.5, 0, 0),
    borderWidth: 1
  });
  coverPage.drawText(isSynced ? 'VERIFIED: PDF Ground Truth matches Excel Payload' : 'WARNING: Reconciliation Discrepancy Detected', {
    x: 65, y: yPos - 5, size: 10, font: timesBoldFont,
    color: isSynced ? rgb(0, 0.4, 0) : rgb(0.6, 0, 0)
  });

  // --- PAGE 2: CONTRACT EVIDENCE (SLICED) ---
  // If we know which page this recipient is on, we slice it from the master PDF
  // For now, if pageSource is 0, we skip.
  const pageSource = (recipient as any).pageSource || 0;
  if (pageSource > 0 && masterPdfBytes) {
    const masterDoc = await PDFDocument.load(masterPdfBytes);
    const [evidencePage] = await pdfDoc.copyPages(masterDoc, [pageSource - 1]);
    pdfDoc.addPage(evidencePage);
    
    // Add annotation to the sliced page
    const lastPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    lastPage.drawRectangle({
        x: 0, y: lastPage.getSize().height - 20, width: lastPage.getSize().width, height: 20,
        color: rgb(0, 0, 0), opacity: 0.8
    });
    lastPage.drawText(`EVIDENCE: Page ${pageSource} of Original Contract PDF`, {
        x: 20, y: lastPage.getSize().height - 14, size: 8, font: timesBoldFont, color: rgb(1, 1, 1)
    });
  }

  // --- PAGE 3: ATTACHMENTS (KTP & PHOTO) ---
  if (ktpBytes || proofBytes) {
    const attachmentPage = pdfDoc.addPage([595.28, 841.89]);
    let currentY = attachmentPage.getSize().height - 50;

    if (ktpBytes) {
        attachmentPage.drawText('ATTACHMENT 1: IDENTITY PROOF (KTP)', { x: 50, y: currentY, size: 12, font: timesBoldFont });
        currentY -= 200;
        try {
            const ktpImage = await pdfDoc.embedJpg(ktpBytes).catch(() => pdfDoc.embedPng(ktpBytes));
            const dims = ktpImage.scale(0.4);
            attachmentPage.drawImage(ktpImage, { x: 50, y: currentY, width: dims.width, height: dims.height });
            currentY -= 50;
        } catch (e) {
            attachmentPage.drawText('[Error rendering KTP image]', { x: 50, y: currentY + 100, size: 10, color: rgb(1, 0, 0) });
        }
    }

    if (proofBytes) {
        currentY -= 30;
        attachmentPage.drawText('ATTACHMENT 2: DELIVERY PROOF (PHOTO)', { x: 50, y: currentY, size: 12, font: timesBoldFont });
        currentY -= 350;
        try {
            const proofImage = await pdfDoc.embedJpg(proofBytes).catch(() => pdfDoc.embedPng(proofBytes));
            const dims = proofImage.scaleToFit(500, 300);
            attachmentPage.drawImage(proofImage, { x: 50, y: currentY, width: dims.width, height: dims.height });
        } catch (e) {
            attachmentPage.drawText('[Error rendering Proof image]', { x: 50, y: currentY + 200, size: 10, color: rgb(1, 0, 0) });
        }
    }
  }

  return await pdfDoc.save();
}

/**
 * Creates a ZIP file containing all recipient bundles.
 */
export async function generateContractZip(
    contract: ContractData,
    onProgress?: (current: number, total: number) => void
): Promise<Blob> {
    const zip = new JSZip();
    const folder = zip.folder(`${contract.name}_Audit_Bundles`);
    
    // Load Master PDF
    let masterPdfBytes: Uint8Array | null = null;
    if (contract.contractPdfPath) {
        masterPdfBytes = await readFile(contract.contractPdfPath);
    }

    const total = contract.recipients.length;
    for (let i = 0; i < total; i++) {
        const r = contract.recipients[i];
        
        // Load attachments if paths exist
        // Note: Real implementation would need to resolve actual file paths from KTP/Proof dirs
        // For now, we pass null to generateRecipientBundle
        
        const bundleBytes = await generateRecipientBundle(
            contract, 
            r, 
            masterPdfBytes || new Uint8Array(),
        );
        
        folder?.file(`${r.nik}_${r.name.replace(/[^a-z0-9]/gi, '_')}.pdf`, bundleBytes);
        
        if (onProgress) onProgress(i + 1, total);
    }

    return await zip.generateAsync({ type: 'blob' });
}
