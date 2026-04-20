# [Fulfillment-001] Expert BAST Generation Service
import os
import asyncio
from datetime import datetime
from typing import Dict, Any, List
from playwright.async_api import async_playwright
from backend.config import settings

class BASTGenerator:
    def __init__(self):
        self.template_path = os.path.join(settings.BASE_DIR, "backend", "templates", "bast_template.html")
        os.makedirs(os.path.dirname(self.template_path), exist_ok=True)
        self._ensure_template_exists()

    def _ensure_template_exists(self):
        if not os.path.exists(self.template_path):
            with open(self.template_path, "w", encoding="utf-8") as f:
                f.write(self._default_template())

    async def generate_pdf(self, data: Dict[str, Any], output_path: str):
        """Renders the BAST template to a high-fidelity PDF using Playwright."""
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            
            # Populate HTML header/footer/body
            html_content = self._hydrate_template(data)
            await page.set_content(html_content)
            
            # Expert PDF settings: A4, 1.0 margin, Print background
            await page.pdf(
                path=output_path,
                format="A4",
                margin={"top": "20mm", "bottom": "20mm", "left": "20mm", "right": "20mm"},
                print_background=True,
                display_header_footer=False
            )
            await browser.close()

    def _hydrate_template(self, data: Dict[str, Any]) -> str:
        """Injects data into the HTML template with fallback values."""
        template = ""
        with open(self.template_path, "r", encoding="utf-8") as f:
            template = f.read()

        # Forensic fallback logic
        mappings = {
            "{{NOMOR_BAST}}": data.get("nomor_bast", "..........................."),
            "{{TANGGAL_BAST}}": data.get("tanggal_bast", datetime.now().strftime("%d %B %Y")),
            "{{NOMOR_KONTRAK}}": data.get("nomor_kontrak", "N/A"),
            "{{NAMA_KEGIATAN}}": data.get("nama_kegiatan", "Penyaluran Bantuan Pemerintah"),
            "{{NAMA_PENERIMA}}": data.get("penerima_nama", "N/A"),
            "{{NIK_PENERIMA}}": data.get("penerima_nik", "N/A"),
            "{{ALAMAT_PENERIMA}}": data.get("penerima_alamat", "N/A"),
            "{{JUMLAH_VOLUME}}": str(data.get("volume", "0")),
            "{{NILAI_KONTRAK}}": f"Rp. {data.get('nilai', 0):,.0f}",
            "{{NAMA_PPK}}": data.get("nama_ppk", "..........................."),
            "{{NIP_PPK}}": data.get("nip_ppk", "..........................."),
            "{{NAMA_VENDOR}}": data.get("nama_vendor", "..........................."),
        }

        for key, val in mappings.items():
            template = template.replace(key, str(val))
        
        return template

    def _default_template(self) -> str:
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; padding: 0; }
                .header { text-align: center; font-weight: bold; margin-bottom: 30px; text-decoration: underline; font-size: 14pt; }
                .section { margin-bottom: 20px; }
                .indent { margin-left: 40px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                td { vertical-align: top; padding: 2px 0; }
                .label { width: 180px; }
                .separator { width: 20px; text-align: center; }
                .footer { margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid; }
                .signature-box { text-align: center; width: 45%; }
                .sig-space { height: 80px; }
                .bold { font-weight: bold; }
                .uppercase { text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="header">BERITA ACARA SERAH TERIMA (BAST) <br> NOMOR : {{NOMOR_BAST}}</div>
            
            <div class="section">
                Pada hari ini, tanggal <b>{{TANGGAL_BAST}}</b>, bertempat di {{ALAMAT_PENERIMA}}, kami yang bertanda tangan di bawah ini:
            </div>

            <div class="section">
                <table>
                    <tr><td class="label">Nama</td><td class="separator">:</td><td class="bold">{{NAMA_VENDOR}}</td></tr>
                    <tr><td class="label">Jabatan</td><td class="separator">:</td><td>Penyedia Barang/Jasa</td></tr>
                    <tr><td colspan="3">Selanjutnya disebut sebagai <b>PIHAK PERTAMA</b></td></tr>
                </table>
            </div>

            <div class="section">
                <table>
                    <tr><td class="label">Nama</td><td class="separator">:</td><td class="bold">{{NAMA_PENERIMA}}</td></tr>
                    <tr><td class="label">NIK</td><td class="separator">:</td><td>{{NIK_PENERIMA}}</td></tr>
                    <tr><td class="label">Alamat</td><td class="separator">:</td><td>{{ALAMAT_PENERIMA}}</td></tr>
                    <tr><td colspan="3">Selanjutnya disebut sebagai <b>PIHAK KEDUA</b></td></tr>
                </table>
            </div>

            <div class="section">
                PIHAK PERTAMA telah menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA telah menerima dari PIHAK PERTAMA Barang/Jasa untuk Pekerjaan <b>{{NAMA_KEGIATAN}}</b> berdasarkan Kontrak Nomor <b>{{NOMOR_KONTRAK}}</b>, dengan rincian sebagai berikut:
            </div>

            <div class="section indent">
                <table>
                    <tr style="border-bottom: 1px solid #000; border-top: 1px solid #000;">
                        <th style="text-align: left; padding: 10px;">Deskripsi Barang</th>
                        <th style="text-align: right; padding: 10px;">Volume</th>
                        <th style="text-align: right; padding: 10px;">Keterangan</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px;">{{NAMA_KEGIATAN}}</td>
                        <td style="padding: 10px; text-align: right;">{{JUMLAH_VOLUME}} Unit</td>
                        <td style="padding: 10px; text-align: right;">Baik/Baru</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                Demikian Berita Acara Serah Terima ini dibuat dalam rangkap yang cukup untuk dipergunakan sebagaimana mestinya.
            </div>

            <div class="footer">
                <div class="signature-box">
                    <div>Yang Menerima,</div>
                    <div class="bold">PIHAK KEDUA</div>
                    <div class="sig-space"></div>
                    <div class="bold text-decoration: underline;">{{NAMA_PENERIMA}}</div>
                    <div>NIK. {{NIK_PENERIMA}}</div>
                </div>
                <div class="signature-box">
                    <div>Yang Menyerahkan,</div>
                    <div class="bold">PIHAK PERTAMA</div>
                    <div class="sig-space"></div>
                    <div class="bold text-decoration: underline;">{{NAMA_VENDOR}}</div>
                    <div>Penyedia</div>
                </div>
            </div>

            <div style="margin-top: 30px; text-align: center;">
                <div style="font-size: 10pt; color: #555;"><i>Dokumen ini dihasilkan secara otomatis oleh Bastbanpem Intelligence System.</i></div>
            </div>
        </body>
        </html>
        """

bast_generator = BASTGenerator()
