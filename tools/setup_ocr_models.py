import os
import requests

def download_file(url, target_path):
    print(f"Downloading {url} to {target_path}...")
    try:
        response = requests.get(url, stream=True, timeout=60, allow_redirects=True)
        if response.status_code == 200:
            with open(target_path, 'wb') as file:
                for data in response.iter_content(8192):
                    file.write(data)
            print(f"Done: {target_path}")
        else:
            print(f"Failed to download {url}. Status: {response.status_code}")
    except Exception as e:
        print(f"Error downloading {url}: {str(e)}")

MODELS = {
    "v5": [
        ("https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv5/ch_PP-OCRv5_det_infer.onnx", "ch_PP-OCRv5_det_infer.onnx"),
        ("https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv5/latin_PP-OCRv5_rec_infer.onnx", "ch_PP-OCRv5_rec_infer.onnx"),
        ("https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv5/ppocrv5_latin_dict.txt", "ppocr_keys_v1.txt")
    ],
    "v4": [
        ("https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx", "ch_PP-OCRv4_det_infer.onnx"),
        ("https://huggingface.co/SWHL/RapidOCR/resolve/main/PP-OCRv4/latin_PP-OCRv4_rec_infer.onnx", "ch_PP-OCRv4_rec_infer.onnx"),
        ("https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/ppocr/utils/dict/latin_dict.txt", "ppocr_keys_v1.txt")
    ]
}

os.makedirs("models/v4", exist_ok=True)
os.makedirs("models/v5", exist_ok=True)

for version, items in MODELS.items():
    for url, filename in items:
        target_path = os.path.join("models", version, filename)
        # Re-download if file is small or missing
        if not os.path.exists(target_path) or os.path.getsize(target_path) < 5000:
            download_file(url, target_path)
        else:
            print(f"File already exists and valid: {target_path}")

print("OCR Model setup complete.")
