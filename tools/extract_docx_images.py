import zipfile
import os
import sys

def extract_images(docx_path, out_dir):
    if not os.path.exists(out_dir):
        os.makedirs(out_dir)
    
    with zipfile.ZipFile(docx_path, 'r') as z:
        for f in z.namelist():
            if f.startswith('word/media/'):
                z.extract(f, out_dir)
                print(f"Extracted: {f}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python extract_images.py <docx_path> <out_dir>")
        sys.exit(1)
    
    extract_images(sys.argv[1], sys.argv[2])
