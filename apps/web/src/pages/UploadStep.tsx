import React, { useState, useRef, useCallback } from 'react';
import type { ImageMetadata } from '@svg-map/types';
import { uploadFloorplan } from '../lib/api.js';

interface UploadStepProps {
  onComplete: (jobId: string, previewUrl: string, metadata?: ImageMetadata) => void;
}

const ACCEPTED_TYPES = ['image/jpeg'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadStep({ onComplete }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((selectedFile: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Only JPEG files (.jpg, .jpeg) are accepted.');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewSrc(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      validateAndSetFile(dropped);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      validateAndSetFile(selected);
    }
  }

  async function handleUpload() {
    if (!file) return;

    setError(null);
    setUploading(true);

    try {
      const { jobId, previewUrl, metadata } = await uploadFloorplan(file);
      onComplete(jobId, previewUrl, metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <h2>Upload Floorplan</h2>
      <p className="subtitle">Upload a JPEG image of your floorplan to get started.</p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop a JPEG file here or click to browse"
      >
        <p>
          <strong>Click to browse</strong> or drag and drop
        </p>
        <p>JPEG files only</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Select floorplan file"
      />

      {file && previewSrc && (
        <div className="file-preview">
          <img src={previewSrc} alt="Floorplan preview" />
          <div>
            <div className="file-name">{file.name}</div>
            <div className="file-size">{formatFileSize(file.size)}</div>
          </div>
        </div>
      )}

      <div className="form-actions">
        <div />
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <>
              <span className="spinner-sm" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Uploading...
            </>
          ) : (
            'Upload'
          )}
        </button>
      </div>
    </div>
  );
}
