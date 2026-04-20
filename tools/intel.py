import sys
import os
from typing import List, Optional, Tuple
from tree_sitter import Language, Parser, Query, QueryCursor
import tree_sitter_python as tspython
import tree_sitter_typescript as rststypescript
import subprocess

# Initialize Languages
PY_LANGUAGE = Language(tspython.language())
TS_LANGUAGE = Language(rststypescript.language_typescript())
TSX_LANGUAGE = Language(rststypescript.language_tsx())

class MethodExtractor:
    def __init__(self, language_type="python"):
        if language_type == "python":
            self.language = PY_LANGUAGE
        elif language_type == "typescript":
            self.language = TS_LANGUAGE
        elif language_type == "tsx":
            self.language = TSX_LANGUAGE
        else:
            self.language = PY_LANGUAGE
            
        self.parser = Parser(self.language)

    def list_methods(self, code: str) -> List[Tuple[str, int, int]]:
        """Returns a list of (name, start_line, end_line) for all functions/classes."""
        tree = self.parser.parse(bytes(code, "utf8"))
        
        # Query for Python or TS
        if self.language in [TS_LANGUAGE, TSX_LANGUAGE]:
            query_str = """
                (function_declaration
                    name: (identifier) @name) @func
                (class_declaration
                    name: (type_identifier) @name) @class
                (variable_declarator
                    name: (identifier) @name
                    value: [(arrow_function) (function_expression)]) @func
                (method_definition
                    name: (property_identifier) @name) @func
            """
        else:
            query_str = """
                (function_definition
                    name: (identifier) @name) @func
                (class_definition
                    name: (identifier) @name) @class
            """
            
        query = Query(self.language, query_str)
        
        cursor = QueryCursor(query)
        matches = cursor.matches(tree.root_node)
        
        methods = []
        for _, match_captures in matches:
            name_node = match_captures.get("name", [None])[0]
            obj_node = match_captures.get("func", [None])[0] or match_captures.get("class", [None])[0]
            
            if name_node and obj_node:
                methods.append((
                    name_node.text.decode("utf8"),
                    obj_node.start_point[0] + 1,
                    obj_node.end_point[0] + 1
                ))
        
        return methods

    def extract_method(self, code: str, method_name: str) -> Optional[str]:
        """Extracts the source code of a specific method/class by name."""
        tree = self.parser.parse(bytes(code, "utf8"))
        
        # Build language-specific query
        if self.language in [TS_LANGUAGE, TSX_LANGUAGE]:
            query_str = f"""
                (function_declaration
                    name: (identifier) @name (#eq? @name "{method_name}")) @func
                (class_declaration
                    name: (type_identifier) @name (#eq? @name "{method_name}")) @class
                (variable_declarator
                    name: (identifier) @name (#eq? @name "{method_name}")
                    value: [(arrow_function) (function_expression)]) @func
                (method_definition
                    name: (property_identifier) @name (#eq? @name "{method_name}")) @func
            """
        else:
            query_str = f"""
                (function_definition
                    name: (identifier) @name (#eq? @name "{method_name}")) @func
                (class_definition
                    name: (identifier) @name (#eq? @name "{method_name}")) @class
            """
            
        query = Query(self.language, query_str)
        
        cursor = QueryCursor(query)
        matches = cursor.matches(tree.root_node)
        for _, match_captures in matches:
            obj_node = match_captures.get("func", [None])[0] or match_captures.get("class", [None])[0]
            if obj_node:
                return obj_node.text.decode("utf8")
        return None

def run_semgrep(pattern: str, file_path: str):
    """Surgical pattern search using Semgrep."""
    scripts_dir = r"C:\Users\Wyx\AppData\Local\Python\pythoncore-3.14-64\Scripts"
    semgrep_path = os.path.join(scripts_dir, "semgrep.exe")
    
    cmd = [semgrep_path, "--pattern", pattern, "--lang", "python", file_path, "--quiet", "--json"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr}"

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python intel.py [list|read|search] [file] [method/pattern]")
        sys.exit(1)
        
    cmd = sys.argv[1]
    target_file = sys.argv[2]
    
    if not os.path.exists(target_file):
        print(f"File not found: {target_file}")
        sys.exit(1)
        
    with open(target_file, "r", encoding="utf8") as f:
        content = f.read()

    extractor = MethodExtractor("python")
    if target_file.endswith(".ts"):
        extractor = MethodExtractor("typescript")
    elif target_file.endswith(".tsx"):
        extractor = MethodExtractor("tsx")
    
    if cmd == "list":
        methods = extractor.list_methods(content)
        print(f"Methods in {target_file}:")
        for name, start, end in methods:
            print(f"  - {name} (Lines {start}-{end})")
            
    elif cmd == "read":
        if len(sys.argv) < 4:
            print("Error: Specify method name")
            sys.exit(1)
        method_name = sys.argv[3]
        fragment = extractor.extract_method(content, method_name)
        if fragment:
            print(f"--- {method_name} in {target_file} ---")
            print(fragment)
        else:
            print(f"Method '{method_name}' not found.")
            
    elif cmd == "search":
        if len(sys.argv) < 4:
            print("Error: Specify semgrep pattern")
            sys.exit(1)
        pattern = sys.argv[3]
        print(run_semgrep(pattern, target_file))
