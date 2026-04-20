from tree_sitter import Language, Parser, Query
import tree_sitter_typescript as rststypescript

TSX_LANGUAGE = Language(rststypescript.language_tsx())

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

try:
    q = Query(TSX_LANGUAGE, query_str)
    print("SUCCESS")
    
    code = """
    export const Workspace = () => {};
    function MyF() {}
    class MyC {}
    const Other = function() {};
    """
    parser = Parser(TSX_LANGUAGE)
    tree = parser.parse(bytes(code, "utf8"))
    matches = q.matches(tree.root_node)
    for _, match_captures in matches:
        name_node = match_captures.get("name", [None])[0]
        if name_node:
            print(f"Found: {name_node.text.decode('utf8')}")

except Exception as e:
    print(f"FAILURE: {e}")
