import json
import os

def generate_final_blueprint():
    audit_path = "complete_detail_audit.json"
    target_path = r"C:\Users\Wyx\Desktop\sitemap-bastbanpem\sitemap.html"

    if not os.path.exists(audit_path):
        print("Error: complete_detail_audit.json not found.")
        return

    with open(audit_path, "r") as f:
        data = json.load(f)

    tabs_html = ""
    for tab_name, content in data["tabs"].items():
        fields_rows = "".join([f"<tr><td>{f['label']}</td><td><code>{f['name']}</code></td><td>{f['type']}</td><td>{f['required']}</td></tr>" for f in content["fields"]])
        buttons_rows = "".join([f"<li>{b['text']} (<code>{b['id']}</code>) - <em>{b['type']}</em></li>" for b in content["buttons"][:15]])
        
        tabs_html += f"""
        <div class="card" data-search="{tab_name}">
            <div class="card-header">{tab_name} Tab</div>
            
            <h3>Data Input Fields</h3>
            <table>
                <thead><tr><th>Label</th><th>ID/Name</th><th>Type</th><th>Required</th></tr></thead>
                <tbody>{fields_rows if fields_rows else '<tr><td colspan="4">No explicit fields detected</td></tr>'}</tbody>
            </table>

            <h3>Primary Actions & Buttons</h3>
            <ul>{buttons_rows if buttons_rows else '<li>No actions detected</li>'}</ul>
        </div>
        """

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BastBanpem Portal - Final Blueprint</title>
    <style>
        body {{ font-family: 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }}
        .container {{ max-width: 1400px; margin: auto; }}
        h1 {{ color: #38bdf8; border-bottom: 3px solid #38bdf8; padding-bottom: 10px; margin-bottom: 30px; }}
        .card {{ background: #1e293b; padding: 25px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }}
        .card-header {{ font-size: 1.5em; font-weight: bold; color: #f8fafc; margin-bottom: 20px; border-left: 5px solid #38bdf8; padding-left: 15px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; background: #0f172a; }}
        th, td {{ padding: 12px; border: 1px solid #334155; text-align: left; }}
        th {{ background: #334155; color: #38bdf8; }}
        code {{ background: #334155; padding: 2px 5px; border-radius: 4px; color: #fbbf24; font-size: 0.9em; }}
        .search-box {{ width: 100%; padding: 15px; margin-bottom: 30px; background: #1e293b; border: 2px solid #38bdf8; border-radius: 10px; color: white; font-size: 1.1em; }}
        ul {{ columns: 2; }}
        li {{ margin-bottom: 8px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>[FINAL] BastBanpem Portal Master Blueprint</h1>
        <input type="text" class="search-box" id="searchInput" placeholder="Search tabs, fields, button IDs, or action names...">
        
        <div id="tabsContainer">
            {tabs_html}
        </div>
    </div>

    <script>
        document.getElementById('searchInput').addEventListener('keyup', function() {{
            const filter = this.value.toUpperCase();
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {{
                const text = card.innerText.toUpperCase();
                card.style.display = text.indexOf(filter) > -1 ? '' : 'none';
            }});
        }});
    </script>
</body>
</html>
"""
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding='utf-8') as f:
        f.write(html_content)
    print(f"Final Blueprint generated at: {target_path}")

if __name__ == "__main__":
    generate_final_blueprint()
