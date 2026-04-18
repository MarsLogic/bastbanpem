# Coding Patterns & Best Practices

These are the patterns established in this codebase. Every new AI session should follow these to stay consistent.

## Python Backend Patterns

### 1. Config-Driven Design
```python
# ✅ DO THIS
from backend.config import settings
batch_size = settings.BATCH_SIZE

# ❌ DON'T HARDCODE
batch_size = 1000
```

### 2. Async/Await for I/O
```python
# ✅ DO THIS
async def process_file(file_path: str):
    data = await read_file_async(file_path)
    return await process_data_async(data)

# ❌ DON'T BLOCK
def process_file(file_path: str):
    data = open(file_path).read()  # Blocks event loop!
```

### 3. Polars Lazy Evaluation
```python
# ✅ DO THIS (lazy)
df = pl.scan_csv("file.csv").filter(col("amount") > 0).collect()

# ❌ DON'T LOAD EVERYTHING
df = pl.read_csv("file.csv")  # Eager, uses RAM immediately
```

### 4. Memory Management
```python
# ✅ DO THIS
import gc
result = process_large_data()
del large_temp_variable
gc.collect()

# ❌ DON'T LEAK MEMORY
result = process_large_data()  # Temp variables still in RAM
```

### 5. Exception Handling
```python
# ✅ DO THIS
from backend.exceptions import ValidationError, ProcessingError

try:
    data = validate_input(user_data)
except ValidationError as e:
    logger.error(f"Validation failed: {e}")
    raise ProcessingError(f"Cannot process: {e}")

# ❌ DON'T USE GENERIC EXCEPTIONS
except Exception as e:
    print("Error")  # Lost context, wrong level
```

### 6. Context Managers for Resources
```python
# ✅ DO THIS
from PyPDF2 import PdfReader

with open("document.pdf", "rb") as pdf_file:
    reader = PdfReader(pdf_file)
    pages = reader.pages
    # Handle automatically closes here

# ❌ DON'T FORGET CLEANUP
pdf_file = open("document.pdf", "rb")
reader = PdfReader(pdf_file)
# File might stay open!
```

## FastAPI Endpoint Patterns

### 1. Structure
```python
# ✅ DO THIS
@router.post("/process-document")
async def process_document(file: UploadFile):
    """
    Process a PDF document.
    
    Args:
        file: PDF file to process
    
    Returns:
        ProcessResult with extracted data
    
    Raises:
        ValidationError: If file is invalid
    """
    # Validate input
    if not file.filename.endswith(".pdf"):
        raise ValidationError("Only PDF files supported")
    
    # Process
    result = await pdf_service.process(file)
    
    # Return response
    return ProcessResult(success=True, data=result)
```

### 2. Always Use [UIUX-001] API Bridge
- Frontend calls go through `src/lib/api.ts`
- Backend endpoints return consistent JSON
- Status codes: 200 (OK), 400 (validation), 500 (error)

## React/TypeScript Frontend Patterns

### 1. API Calls Through Bridge
```typescript
// ✅ DO THIS (api.ts)
export const searchDocuments = async (query: string) => {
  const response = await axios.post('/api/documents/search', { query });
  return response.data;
};

// Component usage
const [results] = await api.searchDocuments(searchTerm);

// ❌ DON'T CALL DIRECTLY
const response = await fetch('http://localhost:8000/api/...');  // No bridge!
```

### 2. Component Structure
```typescript
// ✅ DO THIS
interface DocumentGridProps {
  documents: Document[];
  onSelect: (doc: Document) => void;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
  documents,
  onSelect,
}) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  return (
    <div className="grid gap-4">
      {/* Grid content */}
    </div>
  );
};

// ❌ DON'T USE ANY TYPES
export const DocumentGrid = ({ documents, onSelect }) => { ... }
```

### 3. Styling
```typescript
// ✅ DO THIS (Tailwind)
<div className="flex items-center gap-2 p-4 bg-slate-50 rounded-lg">
  Content
</div>

// ❌ DON'T USE INLINE STYLES
<div style={{ display: 'flex', padding: '16px' }}>
```

## Address / Location Normalisation Pattern

**Always use [DOCS-004] when you need to clean or parse any INAPROC address string.**

```python
# ✅ DO THIS — handles all INAPROC address variants
from backend.services.address_parser import address_parser

result = address_parser.parse(raw_string)
# Returns: { alamat_lengkap, nama_poktan, desa, kecamatan, kabupaten, provinsi, kode_pos }

# For bulk parsing:
results = address_parser.parse_many(list_of_raw_strings)
```

**Individual normalisation (when you only need one level):**
```python
# Province only
parser = InaprocAddressParser()
prov = parser.normalise_province("Kali- mantan Selatan")    # → "Kalimantan Selatan"

# Kabupaten (optionally scoped to a province for better accuracy)
kab  = parser.normalise_kabupaten("Labuhan batu", provinsi="Sumatera Utara")  # → "Kabupaten Labuhanbatu"

# Kecamatan (optionally scoped to kabupaten)
kec  = parser.normalise_kecamatan("Sei Tebelian", kabupaten="Kabupaten Sintang")  # → "Sungai Tebelian"
```

**Reference data is in:** `backend/data/wilayah_reference.json` — do NOT delete this file.  
**Source:** Kemendagri administrative data via ibnux/data-indonesia (refreshable by re-running the fetch script).

---

## Testing Patterns

### 1. Test Structure
```python
# ✅ DO THIS
class TestDataEngine:
    @pytest.fixture
    def engine(self):
        return DataEngine(config.test_config())
    
    def test_csv_ingestion(self, engine):
        df = engine.ingest_csv("test.csv")
        assert len(df) > 0
        assert "location" in df.columns
```

## Git Commit Patterns

### 1. Commit Message Format
```
# ✅ DO THIS
feat: [UIUX-003] add search filter to DocumentManager

- Implements regex pattern matching on document titles
- Respects existing grid sorting behavior
- No performance impact on 1000+ document sets

# ❌ DON'T DO THIS
fixed stuff
Update component
changes
```

---

## Intelligence & Data Repair Patterns

### 1. The "Deep Healing" Phone Pattern
**Standard**: All Indonesian phone numbers must be normalized to a standard `08...` format, even when truncated or double-prefixed.
```typescript
// ✅ DO THIS (src/lib/dataCleaner.ts)
// 1. Detect common truncated prefixes (missing '8') in 10-digit segments
const mobileTruncatedPrefixes = ['1', '2', '3', '5', '7', '9'];
if (clean.length === 10 && mobileTruncatedPrefixes.includes(clean[0])) {
    clean = '8' + clean;
}
// 2. Format to 08...
return `0${clean}`;
```
- Restores all major carriers (Telkomsel, Indosat, XL, etc.).
- Eliminates "Double 62" artifacts.

### 2. High Confidence Regional Bridge
**Standard**: Resolve fragmented location data by bridging missing tiers when top and bottom matches are strong.
- If **Kabupaten** confidence > 0.6 AND **Desa** confidence > 0.6:
- **FORCE** resolve the **Kecamatan** from the master dataset bridge.
- **Why**: Prevents UI "blank spots" caused by typos in a single tier.

### 3. Reactive Data Hydration
**Standard**: Background intelligence components (Triangulation) MUST observe the `isLoaded` state of master data stores.
```typescript
// ✅ DO THIS
const { isLoaded } = useMasterDataStore();
const results = useMemo(() => {
    if (!isLoaded) return initial_data;
    return triangulate(data);
}, [data, isLoaded]); // Reactive dependency on load state
```
- Provides visual feedback ("Analyzing Locations...") during hydration.
- Automatically re-calculates data once the 83k-record master set is ready.

---

## Checklist Before Submitting Code

- [ ] No hardcoded config values
- [ ] All I/O is async
- [ ] Custom exceptions used, not generic
- [ ] Polars lazy evaluation (if applicable)
- [ ] Resources use context managers
- [ ] API calls go through [UIUX-001]
- [ ] Logical ID ripple check passed
- [ ] Tests exist for new functions
- [ ] Commit message follows pattern
- [ ] No unused imports or variables
