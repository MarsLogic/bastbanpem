import docx
import sys

def extract_text_from_docx(file_path):
    try:
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            full_text.append(para.text)
        return '\n'.join(full_text)
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_docx.py <file_path>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    print(extract_text_from_docx(file_path))
