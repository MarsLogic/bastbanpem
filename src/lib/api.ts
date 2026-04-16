// [UIUX-001] Axios Backend Communication Bridge
import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const fetchHealth = async () => {
  const { data } = await api.get('/health');
  return data;
};

export const ocrKtp = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/ktp/ocr', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const reconcileFiles = async (pdfFile: File, excelFile: File) => {
  const formData = new FormData();
  formData.append('pdf_file', pdfFile);
  formData.append('excel_file', excelFile);
  const { data } = await api.post('/reconcile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const ingestExcel = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/excel/ingest', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const balanceExcel = async (rows: any[], targetTotal: number) => {
  const { data } = await api.post('/excel/balance', { rows, target_total: targetTotal });
  return data;
};

export const resolveLocation = async (loc: any) => {
  const { data } = await api.post('/locations/resolve', loc);
  return data;
};

export const submitAutomation = async (data: any) => {
  const { data: result } = await api.post('/automation/submit', data);
  return result;
};

export const bundleContract = async (payload: any) => {
  const { data } = await api.post('/contracts/bundle', payload, {
    responseType: 'blob'
  });
  return data;
};

export const parsePdf = async (path: string) => {
  const { data } = await api.post('/pdf/parse', { path });
  return data;
};

export const parsePdfFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/pdf/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const saveContract = async (
  id: string,
  name: string,
  targetValue: number,
  metadata: Record<string, any>
): Promise<void> => {
  await api.post(
    `/contracts/save?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&target_value=${targetValue}`,
    { rows: [], metadata }
  );
};

export const splitPdf = async (path: string, pages: number[], outputDir: string, prefix: string) => {
  const { data } = await api.post('/pdf/split', { path, pages, output_dir: outputDir, prefix });
  return data;
};

export const extractCpcl = async (path: string) => {
  const { data } = await api.post('/contracts/cpcl', { path });
  return data;
};

// --- Portal Synchronization & Intelligence [EXPERT-002] ---

export const fetchPortalContractsList = async () => {
  const { data } = await api.get('/portal/contracts');
  return data;
};

export const fetchPortalContractDetails = async (idkontrak: string) => {
  const { data } = await api.get(`/portal/contracts/${idkontrak}`);
  return data;
};

export const syncRecipientToPortal = async (idkontrak: string, recipientData: any) => {
  const { data } = await api.post(`/portal/contracts/${idkontrak}/sync-recipient`, recipientData);
  return data;
};

export const registerMasterRecipient = async (recipientData: any) => {
  const { data } = await api.post('/portal/recipients/register', recipientData);
  return data;
};

export const uploadPortalProof = async (idkontrak: string, idpenerima: string, file: File, type: 'bastb' | 'sj' | 'photo') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  const { data } = await api.post(`/portal/contracts/${idkontrak}/recipients/${idpenerima}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const startPortalBatch = async (idkontrak: string, recipients: any[]) => {
  const { data } = await api.post('/portal/batch/start', { idkontrak, recipients });
  return data;
};

export const fetchBatchStatus = async (batchId: string) => {
  const { data } = await api.get(`/portal/batch/status/${batchId}`);
  return data;
};

export const cancelPortalBatch = async (batchId: string) => {
  const { data } = await api.post(`/portal/batch/cancel/${batchId}`);
  return data;
};

export default api;
