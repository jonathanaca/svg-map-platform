import type { BrandConfig, JobStatusResponse, UploadResponse, ErrorResponse, TracingData, Project, Floorplan, FloorplanVersion, MapObject, ValidationIssue } from '@svg-map/types';

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

// ── Projects ────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`);
  return handleResponse<Project[]>(response);
}

export async function createProject(name: string, buildingName?: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, building_name: buildingName }),
  });
  return handleResponse<Project>(response);
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`);
  return handleResponse<Project>(response);
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
  await handleResponse<{ ok: boolean }>(response);
}

// ── Floorplans ──────────────────────────────────────────────────────────────

export async function addFloorplan(projectId: string, floorName: string, floorIndex?: number): Promise<Floorplan> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/floorplans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ floor_name: floorName, floor_index: floorIndex }),
  });
  return handleResponse<Floorplan>(response);
}

export async function getFloorplan(id: string): Promise<Floorplan> {
  const response = await fetch(`${API_BASE}/floorplans/${id}`);
  return handleResponse<Floorplan>(response);
}

export async function deleteFloorplan(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${id}`, { method: 'DELETE' });
  await handleResponse<{ success: boolean }>(response);
}

export async function saveCanvasState(floorplanId: string, canvasState: unknown): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ canvas_state: canvasState }),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function uploadSourceImage(floorplanId: string, file: File): Promise<{ previewUrl: string }> {
  const formData = new FormData();
  formData.append('source', file);
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/upload-source`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<{ previewUrl: string }>(response);
}

export async function publishFloorplan(floorplanId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/publish`, { method: 'POST' });
  await handleResponse<{ ok: boolean }>(response);
}

export async function listVersions(floorplanId: string): Promise<FloorplanVersion[]> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/versions`);
  return handleResponse<FloorplanVersion[]>(response);
}

export async function createVersion(floorplanId: string, note?: string): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function restoreVersion(floorplanId: string, versionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/versions/${versionId}/restore`, { method: 'POST' });
  await handleResponse<{ ok: boolean }>(response);
}

// ── Objects ─────────────────────────────────────────────────────────────────

export async function listObjects(floorplanId: string): Promise<MapObject[]> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/objects`);
  return handleResponse<MapObject[]>(response);
}

export async function createObject(floorplanId: string, obj: Partial<MapObject>): Promise<MapObject> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/objects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  });
  return handleResponse<MapObject>(response);
}

export async function updateObject(id: string, data: Partial<MapObject>): Promise<void> {
  const response = await fetch(`${API_BASE}/objects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function deleteObject(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/objects/${id}`, { method: 'DELETE' });
  await handleResponse<{ ok: boolean }>(response);
}

export async function bulkUpsertObjects(floorplanId: string, objects: Partial<MapObject>[]): Promise<void> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/objects/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objects }),
  });
  await handleResponse<{ ok: boolean }>(response);
}

export async function exportObjectsCsv(floorplanId: string): Promise<string> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/objects/csv`);
  if (!response.ok) throw new Error('Failed to export CSV');
  return response.text();
}

export async function validateFloorplan(floorplanId: string): Promise<ValidationIssue[]> {
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/validate`);
  const data = await handleResponse<{
    valid: boolean;
    object_count: number;
    issue_count: number;
    issues: Array<{ type: string; object_id: string; message: string }>;
  }>(response);
  // Transform API response to match frontend ValidationIssue shape
  return data.issues.map((issue) => ({
    type: (issue.type === 'duplicate_svg_id' || issue.type === 'invalid_geometry' || issue.type === 'unbounded')
      ? 'error' as const
      : 'warning' as const,
    objectId: issue.object_id,
    message: issue.message,
  }));
}

// ── SVG Import ─────────────────────────────────────────────────────────────

export async function analyzeSvgImport(file: File): Promise<{ tempId: string; analysis: SvgAnalysis }> {
  const formData = new FormData();
  formData.append('svg', file);
  const response = await fetch(`${API_BASE}/import/svg/analyze`, { method: 'POST', body: formData });
  return handleResponse<{ tempId: string; analysis: SvgAnalysis }>(response);
}

export interface SvgAnalysisObject {
  svgId: string;
  suggestedType: string;
  label: string;
  layerName: string;
}

export interface SvgAnalysisLayer {
  name: string;
  objectCount: number;
}

export interface SvgAnalysisIssue {
  message: string;
  severity: 'warning' | 'info';
}

export interface SvgAnalysis {
  layers: SvgAnalysisLayer[];
  objects: SvgAnalysisObject[];
  issues: SvgAnalysisIssue[];
}

export async function confirmSvgImport(data: {
  tempId: string;
  projectName: string;
  floorName: string;
  objectMappings: { svgId: string; objectType: string; label?: string }[];
  outlinePoints?: { x: number; y: number }[];
}): Promise<{ projectId: string; floorplanId: string; objectCount: number }> {
  const response = await fetch(`${API_BASE}/import/svg/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<{ projectId: string; floorplanId: string; objectCount: number }>(response);
}

export async function importObjectsCsv(floorplanId: string, file: File): Promise<{ imported: number }> {
  const text = await file.text();
  const response = await fetch(`${API_BASE}/floorplans/${floorplanId}/objects/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv: text }),
  });
  return handleResponse<{ imported: number }>(response);
}
