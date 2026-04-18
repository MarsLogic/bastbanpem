from backend.services.pdf_intelligence import PDFIntelligence
import inspect
print(inspect.getsource(PDFIntelligence.extract_sections).split('Clean page headers')[1][:500])
