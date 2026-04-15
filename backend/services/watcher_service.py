import time
# [DATA-004] File System Ingestion Watcher
import os
import threading
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from backend.services.pdf_service import extract_pdf_text

logger = logging.getLogger("watcher_service")

class DocumentHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
            
        filepath = event.src_path
        filename = os.path.basename(filepath)
        
        logger.info(f"New file detected: {filename}")
        
        if filename.endswith(".pdf"):
            # Background processing for new PDFs
            try:
                text = extract_pdf_text(filepath)
                logger.info(f"Processed PDF: {filename} ({len(text)} chars extracted)")
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")

class WatcherService:
    def __init__(self):
        self.observer = None
        self.watch_thread = None

    def start(self, path_to_watch: str):
        if not os.path.exists(path_to_watch):
            os.makedirs(path_to_watch)
            
        if self.observer and self.observer.is_alive():
            self.observer.stop()
            
        event_handler = DocumentHandler()
        self.observer = Observer()
        self.observer.schedule(event_handler, path_to_watch, recursive=False)
        self.observer.start()
        
        logger.info(f"Watching folder: {path_to_watch}")

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            logger.info("Watcher stopped.")

watcher_service = WatcherService()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    ws = WatcherService()
    ws.start("inbox")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        ws.stop()
