import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapObjectType } from '@svg-map/types';
import { analyzeSvgImport, confirmSvgImport } from '../lib/api.js';
import type { SvgAnalysis, SvgAnalysisObject } from '../lib/api.js';

type ImportStep = 'upload' | 'review' | 'map' | 'outline' | 'confirm';

const STEPS: { key: ImportStep; label: string; number: number }[] = [
  { key: 'upload', label: 'Upload', number: 1 },
  { key: 'review', label: 'Review', number: 2 },
  { key: 'map', label: 'Map', number: 3 },
  { key: 'outline', label: 'Outline', number: 4 },
  { key: 'confirm', label: 'Confirm', number: 5 },
];

const OBJECT_TYPES: MapObjectType[] = [
  'room', 'desk', 'zone', 'area', 'amenity', 'decorative', 'parking', 'locker',
];

interface ObjectMapping {
  svgId: string;
  objectType: string;
  label: string;
  excluded: boolean;
  layerName: string;
}

export default function ImportPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [tempId, setTempId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SvgAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Review step: layer checkboxes
  const [enabledLayers, setEnabledLayers] = useState<Set<string>>(new Set());

  // Map step: object mappings
  const [mappings, setMappings] = useState<ObjectMapping[]>([]);

  // Outline step
  const [outlinePoints, setOutlinePoints] = useState<{ x: number; y: number }[]>([]);
  const [svgDims, setSvgDims] = useState<{ width: number; height: number } | null>(null);
  const outlineSvgRef = useRef<SVGSVGElement>(null);

  // Confirm step
  const [projectName, setProjectName] = useState('');
  const [floorName, setFloorName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Upload step handlers ───────────────────────────────────────────────

  const handleFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.svg')) {
      setAnalyzeError('Please select an SVG file.');
      return;
    }
    setFile(selectedFile);
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzeSvgImport(selectedFile);
      setTempId(result.tempId);
      setAnalysis(result.analysis);

      // Initialize enabled layers (all on by default)
      const layerNames = new Set(result.analysis.layers.map((l) => l.name));
      setEnabledLayers(layerNames);

      // Initialize mappings from analysis objects
      const initialMappings: ObjectMapping[] = result.analysis.objects.map((obj) => ({
        svgId: obj.svgId,
        objectType: obj.suggestedType,
        label: obj.label,
        excluded: false,
        layerName: obj.layerName,
      }));
      setMappings(initialMappings);

      setStep('review');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to analyze SVG');
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (selected) handleFile(selected);
    },
    [handleFile],
  );

  // ── Review step handlers ───────────────────────────────────────────────

  const toggleLayer = useCallback((layerName: string) => {
    setEnabledLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerName)) next.delete(layerName);
      else next.add(layerName);
      return next;
    });
  }, []);

  const handleReviewNext = useCallback(() => {
    // Exclude objects from disabled layers
    setMappings((prev) =>
      prev.map((m) => ({
        ...m,
        excluded: !enabledLayers.has(m.layerName),
      })),
    );
    setStep('map');
  }, [enabledLayers]);

  // ── Map step handlers ──────────────────────────────────────────────────

  const updateMapping = useCallback(
    (svgId: string, updates: Partial<ObjectMapping>) => {
      setMappings((prev) =>
        prev.map((m) => (m.svgId === svgId ? { ...m, ...updates } : m)),
      );
    },
    [],
  );

  // ── Confirm step handlers ─────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!tempId || !projectName.trim() || !floorName.trim()) return;

    setImporting(true);
    setImportError(null);
    try {
      const objectMappings = mappings
        .filter((m) => !m.excluded)
        .map((m) => ({
          svgId: m.svgId,
          objectType: m.objectType,
          label: m.label || undefined,
        }));

      const result = await confirmSvgImport({
        tempId,
        projectName: projectName.trim(),
        floorName: floorName.trim(),
        objectMappings,
        outlinePoints: outlinePoints.length >= 3 ? outlinePoints : undefined,
      });

      navigate(`/editor/${result.floorplanId}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [tempId, projectName, floorName, mappings, navigate]);

  // ── Derived data ───────────────────────────────────────────────────────

  const includedMappings = mappings.filter((m) => !m.excluded);
  const typeCounts: Record<string, number> = {};
  for (const m of includedMappings) {
    typeCounts[m.objectType] = (typeCounts[m.objectType] || 0) + 1;
  }

  // Group objects by suggested type for review step
  const objectsByType: Record<string, SvgAnalysisObject[]> = {};
  if (analysis) {
    for (const obj of analysis.objects) {
      const type = obj.suggestedType;
      if (!objectsByType[type]) objectsByType[type] = [];
      objectsByType[type].push(obj);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Step indicator */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 32,
        }}
      >
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isDone = i < currentStepIndex;
          return (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: isActive
                    ? 'var(--color-primary)'
                    : isDone
                      ? 'var(--color-success)'
                      : 'var(--color-bg)',
                  color: isActive || isDone ? '#fff' : 'var(--color-text-secondary)',
                  border: `2px solid ${isActive ? 'var(--color-primary)' : isDone ? 'var(--color-success)' : 'var(--color-border)'}`,
                }}
              >
                {isDone ? '\u2713' : s.number}
              </span>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-secondary)',
                }}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 40,
                    height: 2,
                    background: isDone ? 'var(--color-success)' : 'var(--color-border)',
                    marginLeft: 4,
                  }}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Step 1: Upload ────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Import SVG Floor Plan
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            Upload an SVG file to analyze its structure and import it as a floor plan.
          </p>

          {analyzeError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {analyzeError}
            </div>
          )}

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 12,
              padding: '64px 32px',
              textAlign: 'center',
              cursor: analyzing ? 'wait' : 'pointer',
              background: dragOver ? 'rgba(59,130,246,0.05)' : 'var(--color-surface)',
              transition: 'all 150ms ease',
            }}
          >
            {analyzing ? (
              <>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600 }}>Analyzing SVG...</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {file?.name}
                </p>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12, opacity: 0.4 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 600, marginBottom: 4 }}>
                  Drop your SVG file here
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  or click to browse
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".svg"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* ── Step 2: Review ────────────────────────────────────────────── */}
      {step === 'review' && analysis && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Review Analysis
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            Review the detected layers and objects. Uncheck layers to exclude them from import.
          </p>

          {/* Issues */}
          {analysis.issues.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {analysis.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`alert ${issue.severity === 'warning' ? 'alert-error' : ''}`}
                  style={{
                    marginBottom: 8,
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    background: issue.severity === 'warning' ? '#fef3c7' : 'var(--color-bg)',
                    border: `1px solid ${issue.severity === 'warning' ? '#f59e0b' : 'var(--color-border)'}`,
                    borderRadius: 6,
                    color: issue.severity === 'warning' ? '#92400e' : 'var(--color-text-secondary)',
                  }}
                >
                  {issue.severity === 'warning' ? '\u26A0 ' : '\u2139 '}
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {/* Layers */}
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
              Layers ({analysis.layers.length})
            </h3>
            {analysis.layers.map((layer) => (
              <label
                key={layer.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabledLayers.has(layer.name)}
                  onChange={() => toggleLayer(layer.name)}
                  style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                />
                <span style={{ flex: 1, fontWeight: 500 }}>{layer.name}</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  {layer.objectCount} objects
                </span>
              </label>
            ))}
          </div>

          {/* Objects grouped by type */}
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
              Detected Objects ({analysis.objects.length})
            </h3>
            {Object.entries(objectsByType).map(([type, objs]) => (
              <div key={type} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: 'var(--color-bg)',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{type}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    {objs.length} object{objs.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep('upload')}>
              Back
            </button>
            <button className="btn btn-primary" onClick={handleReviewNext}>
              Next: Map Objects
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Map ───────────────────────────────────────────────── */}
      {step === 'map' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Map Objects
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Review and adjust the type for each detected object. Exclude objects you don't want to import.
          </p>

          {/* Type counts summary */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 20,
            }}
          >
            {Object.entries(typeCounts).map(([type, count]) => (
              <span
                key={type}
                style={{
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  textTransform: 'capitalize',
                }}
              >
                {count} {type}{count !== 1 ? 's' : ''}
              </span>
            ))}
            <span
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: '0.78rem',
                fontWeight: 600,
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {mappings.filter((m) => m.excluded).length} excluded
            </span>
          </div>

          {/* Include/Exclude All */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMappings((prev) => prev.map((m) => ({ ...m, excluded: false })))}
              style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            >
              Include All
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMappings((prev) => prev.map((m) => ({ ...m, excluded: true })))}
              style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            >
              Exclude All
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setMappings((prev) => prev.map((m) => ({ ...m, excluded: m.objectType === 'decorative' })))}
              style={{ fontSize: '0.78rem', padding: '4px 12px' }}
            >
              Exclude Decorative Only
            </button>
          </div>

          {/* Object mapping table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Include</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>SVG ID</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Label</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Layer</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr
                    key={m.svgId}
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      opacity: m.excluded ? 0.4 : 1,
                    }}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={!m.excluded}
                        onChange={() => updateMapping(m.svgId, { excluded: !m.excluded })}
                        style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {m.svgId}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        value={m.label}
                        onChange={(e) => updateMapping(m.svgId, { label: e.target.value })}
                        disabled={m.excluded}
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        className="form-input"
                        value={m.objectType}
                        onChange={(e) => updateMapping(m.svgId, { objectType: e.target.value })}
                        disabled={m.excluded}
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
                      >
                        {OBJECT_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
                      {m.layerName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep('review')}>
              Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep('outline')}>
              Next: Draw Outline
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Outline ───────────────────────────────────────────── */}
      {step === 'outline' && tempId && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Draw Floor Outline
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            Click around the building perimeter to trace the floor outline. Click the green starting dot to close the shape.
            {outlinePoints.length > 0 && outlinePoints.length < 3 && (
              <span style={{ color: '#d97706' }}> (Need at least 3 points)</span>
            )}
          </p>

          {/* Outline canvas */}
          <div
            style={{
              background: '#f1f5f9',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
              position: 'relative',
              cursor: 'crosshair',
            }}
          >
            <svg
              ref={outlineSvgRef}
              viewBox={svgDims ? `0 0 ${svgDims.width} ${svgDims.height}` : '0 0 1000 700'}
              style={{ width: '100%', display: 'block', maxHeight: 500 }}
              preserveAspectRatio="xMidYMid meet"
              onClick={(e) => {
                if (!outlineSvgRef.current) return;
                const pt = outlineSvgRef.current.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const ctm = outlineSvgRef.current.getScreenCTM();
                if (!ctm) return;
                const svgPt = pt.matrixTransform(ctm.inverse());
                const x = Math.round(svgPt.x);
                const y = Math.round(svgPt.y);

                // If clicking near the first point and we have 3+ points, close
                if (outlinePoints.length >= 3) {
                  const first = outlinePoints[0];
                  const dist = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
                  const viewBoxW = svgDims?.width || 1000;
                  if (dist < viewBoxW * 0.02) {
                    // Closed — don't add point, outline is done
                    return;
                  }
                }

                setOutlinePoints(prev => [...prev, { x, y }]);
              }}
            >
              {/* SVG floorplan background */}
              <image
                href={`/api/import/svg/preview/${tempId}`}
                width={svgDims?.width || 1000}
                height={svgDims?.height || 700}
                opacity={0.5}
                onLoad={(e) => {
                  // Try to get natural dimensions from the loaded SVG
                  const img = e.currentTarget;
                  if (!svgDims) {
                    // Fetch SVG to get its viewBox dimensions
                    fetch(`/api/import/svg/preview/${tempId}`)
                      .then(r => r.text())
                      .then(svgText => {
                        const match = svgText.match(/viewBox=["']([^"']+)["']/);
                        if (match) {
                          const parts = match[1].split(/[\s,]+/).map(Number);
                          if (parts.length >= 4) {
                            setSvgDims({ width: parts[2], height: parts[3] });
                            return;
                          }
                        }
                        // Fallback: try width/height attributes
                        const wMatch = svgText.match(/width=["']([^"']+)["']/);
                        const hMatch = svgText.match(/height=["']([^"']+)["']/);
                        if (wMatch && hMatch) {
                          setSvgDims({ width: parseFloat(wMatch[1]), height: parseFloat(hMatch[1]) });
                        }
                      })
                      .catch(() => {});
                  }
                }}
              />

              {/* Mapped objects highlighted */}
              {includedMappings.map((m) => {
                const obj = analysis?.objects.find(o => o.svgId === m.svgId);
                if (!obj) return null;
                const geom = (obj as Record<string, unknown>).geometry as { x?: number; y?: number; width?: number; height?: number } | undefined;
                if (!geom || geom.x == null) return null;
                return (
                  <rect
                    key={m.svgId}
                    x={geom.x}
                    y={geom.y}
                    width={geom.width || 50}
                    height={geom.height || 50}
                    fill="rgba(59, 130, 246, 0.15)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    rx={3}
                  />
                );
              })}

              {/* Outline polygon */}
              {outlinePoints.length >= 2 && (
                <polyline
                  points={outlinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={3}
                  strokeLinejoin="round"
                />
              )}
              {/* Closed outline fill */}
              {outlinePoints.length >= 3 && (
                <polygon
                  points={outlinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(22, 163, 74, 0.08)"
                  stroke="#16a34a"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  strokeDasharray="8 4"
                />
              )}

              {/* Points */}
              {outlinePoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={i === 0 && outlinePoints.length >= 3 ? 8 : 5}
                  fill={i === 0 ? '#16a34a' : '#fff'}
                  stroke={i === 0 ? '#15803d' : '#16a34a'}
                  strokeWidth={2}
                  style={{ cursor: i === 0 && outlinePoints.length >= 3 ? 'pointer' : 'default' }}
                  onClick={(e) => {
                    if (i === 0 && outlinePoints.length >= 3) {
                      e.stopPropagation();
                      // Outline is closed — do nothing, it's already a polygon
                    }
                  }}
                />
              ))}
            </svg>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setOutlinePoints(prev => prev.slice(0, -1))}
              disabled={outlinePoints.length === 0}
            >
              Undo Last Point
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setOutlinePoints([])}
              disabled={outlinePoints.length === 0}
            >
              Clear Outline
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
              {outlinePoints.length} point{outlinePoints.length !== 1 ? 's' : ''}
              {outlinePoints.length >= 3 ? ' — outline ready' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep('map')}>
              Back
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setStep('confirm')}
              >
                Skip
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('confirm')}
                disabled={outlinePoints.length < 3}
              >
                Next: Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Confirm ───────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Confirm &amp; Set Up Booking
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            These spaces will be managed through PlaceOS — each one can be set as bookable, occupied, or restricted in real time.
          </p>

          {importError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {importError}
            </div>
          )}

          {/* What gets imported */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
              Spaces to Manage
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              {Object.entries(typeCounts).map(([type, count]) => {
                const statusLabel: Record<string, string> = {
                  room: 'Bookable rooms',
                  desk: 'Bookable desks',
                  locker: 'Assignable lockers',
                  zone: 'Monitored zones',
                  amenity: 'Amenity points',
                  decorative: 'Decorative',
                  area: 'Managed areas',
                };
                return (
                  <div
                    key={type}
                    style={{
                      padding: '14px 16px',
                      background: 'var(--color-bg)',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {count}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                      {statusLabel[type] || type}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Booking explanation */}
            <div style={{ padding: '14px 16px', background: '#f0f7ff', borderRadius: 8, borderLeft: '4px solid #4a90d9', fontSize: '0.85rem', color: '#333' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>How PlaceOS booking works</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span><strong>Available</strong> — space is free and can be booked</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                  <span><strong>Booked</strong> — reserved by a user for a time slot</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  <span><strong>Occupied</strong> — currently in use (sensor-detected)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  <span><strong>Restricted</strong> — not available for booking</span>
                </div>
              </div>
            </div>
          </div>

          {/* Next steps after import */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>
              After Import
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>1</div>
                <div><strong>Draw the floor outline</strong> — use the Draw Outline tool to trace the building boundary</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>2</div>
                <div><strong>Verify room &amp; desk positions</strong> — imported spaces appear on the map, adjust as needed</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>3</div>
                <div><strong>Connect to PlaceOS</strong> — each space gets a unique ID for real-time booking, occupancy tracking, and availability display</div>
              </div>
            </div>
          </div>

          {/* Project details form */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
              Project Details
            </h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  className="form-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Sydney HQ"
                  required
                />
              </div>
              <div className="form-group">
                <label>Floor Name *</label>
                <input
                  className="form-input"
                  value={floorName}
                  onChange={(e) => setFloorName(e.target.value)}
                  placeholder="e.g. Level 1"
                  required
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep('outline')}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || !projectName.trim() || !floorName.trim()}
            >
              {importing ? 'Importing...' : `Import & Set Up ${includedMappings.length} Spaces`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
