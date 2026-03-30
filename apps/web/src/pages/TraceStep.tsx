import React, { useState, useEffect } from 'react';
import type { TracingData, RoomEntry } from '@svg-map/types';
import DrawingCanvas from '../components/DrawingCanvas.js';
import type { PathData, ShapeData } from '../components/DrawingCanvas.js';
import { saveTracing, getTracing, analyzeFloorplan } from '../lib/api.js';
import type { DetectedRoom } from '../lib/api.js';

interface TraceStepProps {
  jobId: string;
  imageWidth: number;
  imageHeight: number;
  onComplete: (tracing: TracingData, detectedRooms?: RoomEntry[]) => void;
  onBack: () => void;
}

export default function TraceStep({ jobId, imageWidth, imageHeight, onComplete, onBack }: TraceStepProps) {
  const [outlinePaths, setOutlinePaths] = useState<PathData[]>([]);
  const [wallPaths, setWallPaths] = useState<PathData[]>([]);
  const [spaceHighlights, setSpaceHighlights] = useState<ShapeData[]>([]);
  const [detectedRooms, setDetectedRooms] = useState<DetectedRoom[]>([]);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const imageUrl = `/api/files/processed/${jobId}.jpg`;

  // Load existing tracing data if any
  useEffect(() => {
    getTracing(jobId)
      .then((data) => {
        if (data.outlinePaths?.length) {
          setOutlinePaths(data.outlinePaths.map((p) => ({
            id: p.id,
            points: p.points,
            closed: p.closed,
          })));
        }
        if (data.wallPaths?.length) {
          setWallPaths(data.wallPaths.map((p) => ({
            id: p.id,
            points: p.points,
            closed: p.closed,
          })));
        }
        if (data.spaceHighlights?.length) {
          setSpaceHighlights(data.spaceHighlights.map((s) => ({
            id: s.id,
            label: s.label,
            type: 'rect' as const,
            x: s.x,
            y: s.y,
            width: s.width,
            height: s.height,
            color: s.color,
          })));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [jobId]);

  async function handleSave() {
    setError(null);
    setSaving(true);

    try {
      const tracing: TracingData = {
        outlinePaths: outlinePaths.map((p) => ({
          id: p.id,
          points: p.points,
          closed: p.closed,
        })),
        wallPaths: wallPaths.map((p) => ({
          id: p.id,
          points: p.points,
          closed: p.closed,
        })),
        spaceHighlights: spaceHighlights.map((s) => ({
          id: s.id,
          label: s.label,
          type: 'rect' as const,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          color: s.color,
        })),
      };

      await saveTracing(jobId, tracing);
      // Pass detected rooms as RoomEntry[] for the Rooms step
      const room_entries: RoomEntry[] = detectedRooms.map((r) => ({
        id: r.id,
        label: r.label,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
      }));
      onComplete(tracing, room_entries.length > 0 ? room_entries : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tracing data.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoDetect() {
    setError(null);
    setAnalyzing(true);

    try {
      const result = await analyzeFloorplan(jobId);

      // Apply outline
      if (result.outline) {
        setOutlinePaths([{
          id: result.outline.id,
          points: result.outline.points,
          closed: result.outline.closed,
        }]);
      }

      // Apply walls
      if (result.walls?.length) {
        setWallPaths(result.walls.map((w) => ({
          id: w.id,
          points: w.points,
          closed: w.closed,
        })));
      }

      // Store detected rooms for passing to the Rooms step
      if (result.rooms?.length) {
        setDetectedRooms(result.rooms);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-detection failed. You can still trace manually.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSkip() {
    onComplete({ outlinePaths: [], wallPaths: [], spaceHighlights: [] });
  }

  if (!loaded) {
    return (
      <div className="card" style={{ maxWidth: 1400 }}>
        <div className="status-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const path_count = outlinePaths.length + wallPaths.length;
  const shape_count = spaceHighlights.length;

  return (
    <div className="card" style={{ maxWidth: 1400 }}>
      <h2>Trace Floorplan</h2>
      <p className="subtitle">
        Use the drawing tools to trace the building outline, walls, and highlight zones.
        This step is optional — you can skip it to use the raster image directly.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          onClick={handleAutoDetect}
          disabled={analyzing}
          style={{ background: '#7c3aed' }}
        >
          {analyzing ? (
            <>
              <span className="spinner-sm" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              Analyzing with AI...
            </>
          ) : (
            'Auto-detect rooms & outline'
          )}
        </button>
        {detectedRooms.length > 0 && (
          <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--color-success)' }}>
            Detected {detectedRooms.length} room(s)
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      <DrawingCanvas
        imageUrl={imageUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        outlinePaths={outlinePaths}
        wallPaths={wallPaths}
        spaceHighlights={spaceHighlights}
        onOutlineChange={setOutlinePaths}
        onWallChange={setWallPaths}
        onSpaceHighlightsChange={setSpaceHighlights}
      />

      <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
        {path_count > 0 || shape_count > 0
          ? `${outlinePaths.length} outline path(s), ${wallPaths.length} wall path(s), ${shape_count} highlight zone(s)`
          : 'No traces yet. Use the tools above to start drawing, or skip this step.'}
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onBack} type="button">
          Back
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleSkip} type="button">
            Skip (use image)
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
