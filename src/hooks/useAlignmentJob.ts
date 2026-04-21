import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

export interface AlignmentJobStatus {
  job_id: string;
  contract_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  total: number;
  error?: string;
  result_json?: string;
  created_at: string;
}

interface UseAlignmentJobProps {
  contractId: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useAlignmentJob({ contractId, onSuccess, onError }: UseAlignmentJobProps) {
  const [activeJob, setActiveJob] = useState<AlignmentJobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollStatus = useCallback(async (jobId: string) => {
    try {
      const { data } = await api.get<AlignmentJobStatus>(`/excel/status/${jobId}`);
      setActiveJob(data);

      if (data.status === 'COMPLETED') {
        stopPolling();
        localStorage.removeItem(`pending_alignment_${contractId}`);
        localStorage.removeItem(`pending_sheet_${contractId}`);
        if (onSuccess && data.result_json) {
          onSuccess(JSON.parse(data.result_json));
        }
      } else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
        stopPolling();
        localStorage.removeItem(`pending_alignment_${contractId}`);
        localStorage.removeItem(`pending_sheet_${contractId}`);
        if (onError) onError(data.error || 'Job failed or was cancelled');
      }
    } catch (err) {
      console.error('Polling failed:', err);
      // Don't stop polling on single fetch error to handle temporary network issues
    }
  }, [contractId, onSuccess, onError, stopPolling]);

  const startJob = useCallback(async (file: File, sheetName?: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contract_id', contractId);
      if (sheetName) formData.append('sheet_name', sheetName);

      const { data } = await api.post(`/excel/start`, formData);
      const jobId = data.job_id;
      
      localStorage.setItem(`pending_alignment_${contractId}`, jobId);
      if (sheetName) {
        localStorage.setItem(`pending_sheet_${contractId}`, sheetName);
      } else {
        localStorage.removeItem(`pending_sheet_${contractId}`);
      }
      setIsPolling(true);
      pollStatus(jobId);
    } catch (err: any) {
      if (onError) onError(err.response?.data?.detail || 'Failed to start ingestion');
    }
  }, [contractId, onError, pollStatus]);

  const cancelJob = useCallback(async () => {
    if (!activeJob) return;
    try {
      await api.post(`/excel/cancel/${activeJob.job_id}`);
      stopPolling();
      localStorage.removeItem(`pending_alignment_${contractId}`);
      localStorage.removeItem(`pending_sheet_${contractId}`);
      setActiveJob(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  }, [activeJob, contractId, stopPolling]);

  // Handle re-attachment and polling loop
  useEffect(() => {
    const savedJobId = localStorage.getItem(`pending_alignment_${contractId}`);
    
    if (savedJobId) {
      setIsPolling(true);
      pollStatus(savedJobId);
    }

    return () => stopPolling();
  }, [contractId]); // Re-attach only on contract change

  useEffect(() => {
    if (isPolling && !pollIntervalRef.current) {
      const jobId = localStorage.getItem(`pending_alignment_${contractId}`);
      if (jobId) {
        pollIntervalRef.current = setInterval(() => pollStatus(jobId), 1500);
      }
    }
    return () => {
      if (!isPolling) stopPolling();
    };
  }, [isPolling, contractId, pollStatus, stopPolling]);

  return {
    activeJob,
    isPolling,
    startJob,
    cancelJob,
    progress: activeJob ? Math.round((activeJob.progress / activeJob.total) * 100) : 0
  };
}
