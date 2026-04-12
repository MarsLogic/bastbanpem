import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

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

export default api;
