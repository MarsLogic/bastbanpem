import json

with open('public/master_locations.json', 'r') as f:
    data = json.load(f)

# Search for Sei Penggantungan
results = [item for item in data if "Sei Penggantungan" in item.get('desa', '') or "Penggantungan" in item.get('desa', '')]

for r in results:
    print(r)

# Search for Jurijanto Simbolon's location if possible
# Kabupaten: Labuhan Batu
labuhan = [item for item in data if "Labuhan Batu" in item.get('kabupaten', '')]
print(f"Total Labuhan Batu records: {len(labuhan)}")
if labuhan:
    print(f"Sample: {labuhan[0]}")
