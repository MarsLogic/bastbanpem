// [UIUX-001] Axios Backend Communication Bridge
import axios from 'axios';

const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL || 'http://127.0.0.1:8000') + '/api';

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

export const probeExcel = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/excel/probe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const ingestExcel = async (file: File, sheetName?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  if (sheetName) {
    formData.append('sheet_name', sheetName);
  }
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
  metadata: Record<string, any> | null,
  ultraRobust?: Record<string, any> | null,
  tables?: any[],
  rows?: any[],
): Promise<void> => {
  await api.post(
    `/contracts/save?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&target_value=${targetValue}`,
    {
      rows: rows ?? [],
      metadata: metadata ?? null,
      ultra_robust: ultraRobust ?? null,
      tables: tables ?? [],
    },
  );
};

/**
 * Load saved AI extraction results (metadata + ultra_robust + tables) for a contract.
 * Returns null if the contract has never been scanned (404).
 */
export const loadContractIntelligence = async (
  contractId: string,
): Promise<{
  metadata: Record<string, any> | null;
  ultraRobust: Record<string, any> | null;
  tables: any[];
  recipients: any[];
} | null> => {
  try {
    const { data } = await api.get(`/contracts/load/${encodeURIComponent(contractId)}`);
    return {
      metadata:     data.metadata     ?? null,
      ultraRobust:  data.ultra_robust ?? null,
      tables:       data.tables       ?? [],
      recipients:   data.recipients   ?? [],
    };
  } catch (err: any) {
    if (err?.response?.status === 404) return null; // never scanned — silent
    throw err;
  }
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

export const generateBast = async (payload: any) => {
    const { data } = await api.post('/contracts/generate-bast', payload, {
        responseType: 'blob'
    });
    return data;
};

export const dispatchBundle = async (idkontrak: string, rows: any[]) => {
    const { data } = await api.post('/contracts/dispatch-bundle', { idkontrak, rows });
    return data;
};

export default api;
