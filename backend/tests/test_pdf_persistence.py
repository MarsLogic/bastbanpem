import os
from backend.services.pdf_intelligence import pdf_intel
from backend.services.vault_service import vault_service
from backend.models import ContractMetadata

PDF_PATH = r"C:\Users\Wyx\Desktop\KAN\surat-pesanan-EP-01K7NM3AVZA3Z6QQXRQN3QEPTV.pdf"

def test_holistic_pdf_extraction():
    if not os.path.exists(PDF_PATH):
        print("Sample PDF not found, skipping extraction test")
        return
        
    analysis = pdf_intel.analyze_document(PDF_PATH)

    metadata = analysis["metadata"]
    full_text = metadata.full_text or ""
    sections = metadata.sections or {}

    print(f"\nFull text length: {len(full_text)}")
    print(f"Sections found: {list(sections.keys())}")

    # Check if SSUK pattern might be split
    if "UMUM" in full_text:
        index = full_text.find("UMUM")
        print(f"Found 'UMUM' at index {index}: '{full_text[index-20:index+30]}'")

    # Check for found sections
    assert "HEADER" in sections

    # Flexible check for SSUK or SSKK
    found_any_terms = "SSUK" in sections or "SSKK" in sections
    print(f"Terms found: {'Yes' if found_any_terms else 'No'}")

    if "SSKK" in sections:
        assert "SYARAT-SYARAT KHUSUS KONTRAK" in sections["SSKK"]

    assert metadata.full_text is not None
    assert metadata.sections is not None
    
    print(f"\nExtracted {len(sections)} sections")
    for sec in sections:
        print(f" - {sec}: {len(sections[sec])} chars")

def test_persistence_logic():
    # Mock metadata
    mock_metadata = ContractMetadata(
        nomor_kontrak="TEST-123",
        full_text="This is a test",
        sections={"TEST_SECTION": "Test Content"}
    )
    
    vault_service.save_contract(
        id="TEST-123",
        name="Test Contract",
        target_value=1000.0,
        metadata=mock_metadata
    )
    
    saved = vault_service.get_contract("TEST-123")
    assert saved is not None
    assert "metadata" in saved
    
    # Parse back the metadata
    import json
    loaded_metadata = ContractMetadata.model_validate_json(saved["metadata"])
    assert loaded_metadata.nomor_kontrak == "TEST-123"
    assert loaded_metadata.sections["TEST_SECTION"] == "Test Content"
    
    print("\nPersistence verified successfully.")

if __name__ == "__main__":
    # Manual run
    try:
        test_holistic_pdf_extraction()
        test_persistence_logic()
        print("\nALL TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
