import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { extractSheetMetadata, processMappedData } from '../src/lib/excelParser';

const rootDir = "C:\\Users\\Wyx\\Desktop\\Project 2026";

function findExcels(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findExcels(fullPath, fileList);
    } else if (fullPath.match(/\.xlsx?$/) && !fullPath.includes('~$')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = findExcels(rootDir);
console.log(`Found ${files.length} Excel files. Commencing audit...`);

interface AuditResult {
  file: string;
  sheet: string;
  success: boolean;
  rowsMatched: number;
  error?: string;
  issues: string[];
}

const results: AuditResult[] = [];

for (const file of files) {
  try {
    const buffer = fs.readFileSync(file);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    
    for (const sheetName of wb.SheetNames) {
      if (sheetName.toLowerCase().includes('form')) continue; // Skip pure template files without data
      
      const issues: string[] = [];
      try {
        const metadata = extractSheetMetadata(wb, sheetName);
        if (!metadata.hasNikPattern && metadata.grid.length > 5) {
            issues.push("No obvious NIK column detected by pattern check.");
        }
        
        let localSuccess = false;
        if (metadata.suggestedMap.nik === -1) {
            // Find manually what looks like NIK 
            for (let i = 0; i < metadata.headers.length; i++) {
                if (metadata.headers[i].toLowerCase().includes('nik') || metadata.headers[i].toLowerCase().includes('ktp')) {
                    metadata.suggestedMap.nik = i;
                    issues.push(`NIK mapped heuristically via Header: [${metadata.headers[i]}], ignoring pattern mismatch.`);
                    break;
                }
            }
        }

        if (metadata.suggestedMap.nik !== -1) {
            const data = processMappedData(metadata, metadata.suggestedMap);
            results.push({
               file: path.relative(rootDir, file),
               sheet: sheetName,
               success: true,
               rowsMatched: data.rows.length,
               issues
            });
            localSuccess = true;
        } else {
            issues.push("FATAL: Could not identify NIK column by pattern or header.");
        }

        if (!localSuccess) {
            results.push({
               file: path.relative(rootDir, file),
               sheet: sheetName,
               success: false,
               rowsMatched: 0,
               issues
            });
        }

      } catch (err: any) {
        results.push({
           file: path.relative(rootDir, file),
           sheet: sheetName,
           success: false,
           rowsMatched: 0,
           error: err.message,
           issues
        });
      }
    }
  } catch (err: any) {
      results.push({
         file: path.relative(rootDir, file),
         sheet: "N/A",
         success: false,
         rowsMatched: 0,
         error: "Cannot read workbook: " + err.message,
         issues: []
      });
  }
}

// Generate report Markdown
let report = `# Excel Extraction Audit Report
Total Files Analyzed: ${files.length}

`;

const successCount = results.filter(r => r.success).length;
const failCount = results.filter(r => !r.success && !!r.error).length;

report += `## Summary
- ✅ Successful Sheet Extractions: ${successCount}
- ❌ Failed Sheet Extractions: ${failCount}

`;

for (const res of results) {
    if (res.rowsMatched === 0 && !res.error && res.issues.length === 0) continue; 
    
    report += `### File: \`${res.file}\` (Sheet: \`${res.sheet}\`)
* **Status**: ${res.success ? `✅ Parsed ${res.rowsMatched} valid recipient rows` : '❌ Failed'}
`;
    if (res.error) {
       report += `* **Error**: \`${res.error}\`\n`;
    }
    if (res.issues.length > 0) {
       report += `* **Structural Anomalies**:\n`;
       for (const issue of res.issues) {
           report += `  - ${issue}\n`;
       }
    }
    report += `\n`;
}

fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/excel_audit_report.md', report);
console.log("Audit complete.");
