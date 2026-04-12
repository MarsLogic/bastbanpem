const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const PROJECT_DIR = 'C:\\Users\\Wyx\\Desktop\\Project 2026';
const OUTPUT_FILE = path.join(__dirname, 'pdf_analysis_report.md');

function getAllPdfs(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            getAllPdfs(fullPath, files);
        } else if (item.toLowerCase().endsWith('.pdf')) {
            files.push(fullPath);
        }
    }
    return files;
}

async function analyzePdfs() {
    console.log("Starting analysis...");
    const files = getAllPdfs(PROJECT_DIR);
    console.log(`Found ${files.length} PDF files.`);

    let report = `# PDF Contract Analysis Report\n\nGenerated on: ${new Date().toLocaleString()}\n\n`;

    for (let i = 0; i < Math.min(files.length, 30); i++) {
        const filePath = files[i];
        console.log(`Analyzing: ${path.basename(filePath)}`);
        
        try {
            const dataBuffer = fs.readFileSync(filePath);
            // Handling potential different module structures
            let text = "";
            let numPages = 0;
            
            if (typeof pdf === 'function') {
                const data = await pdf(dataBuffer);
                text = data.text;
                numPages = data.numpages;
            } else if (pdf.PDFParse) {
                // Some versions export PDFParse class
                const instance = new pdf.PDFParse();
                const data = await instance.parse(dataBuffer);
                text = data.text;
                numPages = data.numpages;
            } else {
                throw new Error("PDF parser module structure unknown");
            }

            report += `## ${path.basename(filePath)}\n`;
            report += `- Path: \`${filePath}\`\n`;
            report += `- Pages: ${numPages}\n`;
            
            const noMatch = text.match(/(?:No|Nomor)\s*Surat\s*Pesanan\s*:\s*([A-Z0-9-/]+)/i);
            report += `- No Pesanan: \`${noMatch ? noMatch[1] : 'NOT FOUND'}\`\n`;
            
            const totalMatch = text.match(/Rp\s*([\d.,]{5,})/);
            report += `- Large Currency Sample: \`${totalMatch ? 'Rp ' + totalMatch[1] : 'NOT FOUND'}\`\n`;
            
            report += `\n---\n\n`;
        } catch (e) {
            report += `## ${path.basename(filePath)}\n- ERROR: ${e.message}\n\n---\n\n`;
        }
    }

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log("Done!");
}

analyzePdfs();
