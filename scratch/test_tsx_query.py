from tree_sitter import Language, Parser, Query
import tree_sitter_typescript as rststypescript

TSX_LANGUAGE = Language(rststypescript.language_tsx())
parser = Parser(TSX_LANGUAGE)

code = """
export const ImageTaggerWorkspace = () => {
  return <div>Test</div>;
};

function MyFunc() {}

class MyClass {}
"""

# Test simpler queries first to find the "Impossible pattern"
test_queries = [
    "(function_declaration name: (identifier) @name) @func",
    "(class_declaration name: (identifier) @name) @class",
    "(method_definition name: (property_identifier) @name) @func",
    # This one is suspicious:
    "(variable_declarator name: (identifier) @name value: (arrow_function) @func)"
]

for q in test_queries:
    try:
        Query(TSX_LANGUAGE, q)
        print(f"SUCCESS: {q}")
    except Exception as e:
        print(f"FAILURE: {q} - {e}")
