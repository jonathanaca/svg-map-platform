import type { BrandConfig, JobStatusResponse, UploadResponse, ErrorResponse, TracingData } from '@svg-map/types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: `Request failed with status ${response.status}`,
    })) as ErrorResponse;

    // Include validation details in the error message if present
    let message = body.error;
    if (body.details && body.details.length > 0) {
      message += ': ' + body.details.map((d) => d.message).join(', ');
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function uploadFloorplan(
  file: File,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('floorplan', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function saveConfig(
  jobId: string,
  config: BrandConfig,
): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  await handleResponse<{ ok: boolean }>(response);
}

export async function generateSvg(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/generate`, {
    method: 'POST',
  });

  await handleResponse<{ ok: boolean }>(response);
}

export async function saveTracing(jobId: string, tracing: TracingData): Promise<void> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/tracing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tracing),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function getTracing(jobId: string): Promise<TracingData> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/tracing`);
  return handleResponse<TracingData>(response);
}

export interface DetectedRoom {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AnalysisResult {
  outline: { id: string; points: { x: number; y: number }[]; closed: boolean } | null;
  walls: { id: string; points: { x: number; y: number }[]; closed: boolean }[];
  rooms: DetectedRoom[];
}

export async function analyzeFloorplan(jobId: string): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/analyze`, {
    method: 'POST',
  });
  return handleResponse<AnalysisResult>(response);
}

export async function getJobStatus(
  jobId: string,
): Promise<JobStatusResponse> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/status`);
  return handleResponse<JobStatusResponse>(response);
}
