import time
# [DATA-004] File System Ingestion Watcher
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from backend.services.pdf_service import extract_pdf_text

class DocumentHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
            
        filepath = event.src_path
        filename = os.path.basename(filepath)
        
        print(f"New file detected: {filename}")
        
        if filename.endswith(".pdf"):
            # Background processing for new PDFs
            try:
                text = extract_pdf_text(filepath)
                print(f"Processed PDF: {filename} ({len(text)} chars extracted)")
            except Exception as e:
                print(f"Error processing {filename}: {e}")

def start_watcher(path_to_watch):
    if not os.path.exists(path_to_watch):
        os.makedirs(path_to_watch)
        
    event_handler = DocumentHandler()
    observer = Observer()
    observer.schedule(event_handler, path_to_watch, recursive=False)
    observer.start()
    
    print(f"Watching folder: {path_to_watch}")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    start_watcher("inbox")
