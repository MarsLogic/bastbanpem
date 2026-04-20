from tree_sitter import Language, Parser, Query
import tree_sitter_typescript as rststypescript

TSX_LANGUAGE = Language(rststypescript.language_tsx())

query_str = """
    (function_declaration
        name: (identifier) @name) @func
    (class_declaration
        name: (identifier) @name) @class
    (arrow_function
        (variable_declarator
            name: (identifier) @name)) @func
    (method_definition
        name: (property_identifier) @name) @func
"""

try:
    Query(TSX_LANGUAGE, query_str)
    print("SUCCESS")
except Exception as e:
    print(f"FAILURE: {e}")
