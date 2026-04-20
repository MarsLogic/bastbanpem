from tree_sitter import Language, Parser, Query
import tree_sitter_typescript as rststypescript

TSX_LANGUAGE = Language(rststypescript.language_tsx())

test_queries = [
    "(class_declaration name: (identifier) @name) @class",
    "(class_declaration name: (type_identifier) @name) @class",
]

for q in test_queries:
    try:
        Query(TSX_LANGUAGE, q)
        print(f"SUCCESS: {q}")
    except Exception as e:
        print(f"FAILURE: {q} - {e}")
