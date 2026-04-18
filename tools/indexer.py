import os
import lancedb
import pyarrow as pa
from intel import MethodExtractor
import tantivy
from tqdm import tqdm

class ProjectIndexer:
    def __init__(self, db_path=".claude/intel_db"):
        self.db_path = db_path
        os.makedirs(db_path, exist_ok=True)
        self.db = lancedb.connect(db_path)
        
        # Schema: File, MethodName, StartLine, EndLine, Content
        self.schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("file_path", pa.string()),
            pa.field("name", pa.string()),
            pa.field("start_line", pa.int32()),
            pa.field("end_line", pa.int32()),
            pa.field("content", pa.string()),
        ])
        
        if "methods" in self.db.table_names():
            self.table = self.db.open_table("methods")
        else:
            self.table = self.db.create_table("methods", schema=self.schema)

    def index_all(self, start_dir="."):
        extractors = {
            "python": MethodExtractor("python"),
            "typescript": MethodExtractor("typescript"),
            "tsx": MethodExtractor("tsx")
        }
        
        data = []
        ignored_dirs = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}
        
        files_to_process = []
        for root, dirs, files in os.walk(start_dir):
            dirs[:] = [d for d in dirs if d not in ignored_dirs]
            for file in files:
                if file.endswith((".py", ".ts", ".tsx")):
                    files_to_process.append(os.path.join(root, file))
        
        print(f"Indexing {len(files_to_process)} files...")
        for file_path in tqdm(files_to_process):
            rel_path = os.path.relpath(file_path, start_dir)
            lang = "python"
            if file_path.endswith(".tsx"): lang = "tsx"
            elif file_path.endswith(".ts"): lang = "typescript"
            
            try:
                with open(file_path, "r", encoding="utf8") as f:
                    content = f.read()
                
                methods = extractors[lang].list_methods(content)
                for name, start, end in methods:
                    method_content = extractors[lang].extract_method(content, name)
                    if method_content:
                        data.append({
                            "id": f"{rel_path}:{name}",
                            "file_path": rel_path,
                            "name": name,
                            "start_line": start,
                            "end_line": end,
                            "content": method_content
                        })
            except Exception as e:
                print(f"Error indexing {file_path}: {e}")
                
        if data:
            self.table.add(data, mode="overwrite")
            print(f"Successfully indexed {len(data)} methods.")

    def search(self, query: str, limit: int = 5):
        # Using LanceDB's built-in FTS or simple keyword search for now
        # Full RAG would need embeddings, but FTS is very surgical.
        results = self.table.search(query).limit(limit).to_list()
        return results

if __name__ == "__main__":
    import sys
    indexer = ProjectIndexer()
    
    if len(sys.argv) > 1 and sys.argv[1] == "index":
        indexer.index_all()
    elif len(sys.argv) > 2 and sys.argv[1] == "search":
        query = " ".join(sys.argv[2:])
        results = indexer.search(query)
        for res in results:
            print(f"\n[{res['file_path']}] {res['name']} (Lines {res['start_line']}-{res['end_line']})")
            # print(res["content"][:200] + "...")
    else:
        print("Usage: python indexer.py [index|search <query>]")
