import os
import sys
from rapidocr_onnxruntime import RapidOCR

def process_images(img_dir):
    engine = RapidOCR()
    all_results = {}
    
    # Recursively find all png files
    image_files = []
    for root, dirs, files in os.walk(img_dir):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                image_files.append(os.path.join(root, file))
    
    # Sort by name (e.g., image1.png, image2.png)
    image_files.sort(key=lambda x: int(''.join(filter(str.isdigit, os.path.basename(x))) or 0))

    for img_path in image_files:
        print(f"Processing {img_path}...")
        try:
            result, _ = engine(img_path)
            if result:
                text_lines = [line[1] for line in result]
                all_results[os.path.basename(img_path)] = text_lines
            else:
                all_results[os.path.basename(img_path)] = ["(No text found)"]
        except Exception as e:
            all_results[os.path.basename(img_path)] = [f"Error: {e}"]
            
    return all_results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_all.py <img_dir>")
        sys.exit(1)
        
    img_dir = sys.argv[1]
    results = process_images(img_dir)
    
    with open("tools/manual_ocr_report.txt", "w", encoding="utf-8") as f:
        for img, lines in results.items():
            f.write(f"--- {img} ---\n")
            f.write("\n".join(lines) + "\n\n")
    
    print("OCR Report saved to tools/manual_ocr_report.txt")
