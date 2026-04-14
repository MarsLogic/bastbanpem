import cv2
import sys
from rapidocr_onnxruntime import RapidOCR

def debug_ocr(img_path):
    engine = RapidOCR(use_angle_cls=True)
    img = cv2.imread(img_path)
    if img is None:
        print("Failed to read image")
        return
    
    # Simple preprocessing
    blue = img[:,:,0]
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    processed = clahe.apply(blue)
    
    result, elapse = engine(processed)
    print(f"Elapsed: {elapse}s")
    if result:
        for i, line in enumerate(result):
            print(f"[{i}] {line[1]} (Conf: {line[2]})")
    else:
        print("No text detected")

if __name__ == "__main__":
    debug_ocr(sys.argv[1])
