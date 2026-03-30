import React from 'react';
import { useJobStatus } from '../hooks/useJobStatus.js';

interface PreviewStepProps {
  jobId: string;
  onBack: () => void;
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  uploading: 'Your floorplan image is being uploaded...',
  processing: 'Analyzing the floorplan image...',
  configuring: 'Applying your brand configuration...',
  generating: 'Generating the SVG map. This may take a moment...',
};

export default function PreviewStep({ jobId, onBack }: PreviewStepProps) {
  const { data, isLoading, error } = useJobStatus(jobId);

  if (isLoading && !data) {
    return (
      <div className="card">
        <div className="status-container">
          <div className="spinner" />
          <div className="status-label">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="alert alert-error" role="alert">
          {error.message}
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onBack} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  const status = data?.status;

  if (status === 'failed') {
    return (
      <div className="card">
        <h2>Generation Failed</h2>
        <div className="alert alert-error" role="alert">
          {data?.error ?? 'An unknown error occurred during SVG generation.'}
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onBack} type="button">
            Back
          </button>
        </div>
      </div>
    );
  }

  if (status === 'complete' && data?.downloadUrl) {
    return (
      <div className="card">
        <h2>SVG Map Ready</h2>
        <p className="subtitle">Your SVG map has been generated successfully.</p>

        <div className="svg-preview">
          <img src={data.downloadUrl} alt="Generated SVG map preview" />
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onBack} type="button">
            Back
          </button>
          <a
            className="btn btn-primary"
            href={data.downloadUrl}
            download
            style={{ textDecoration: 'none' }}
          >
            Download SVG
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Generating SVG</h2>
      <div className="status-container">
        <div className="spinner" />
        <div className="status-label">{status ?? 'Processing'}</div>
        <div className="status-description">
          {status && STATUS_DESCRIPTIONS[status]
            ? STATUS_DESCRIPTIONS[status]
            : 'Please wait while we process your request...'}
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onBack} type="button">
          Back
        </button>
      </div>
    </div>
  );
}
