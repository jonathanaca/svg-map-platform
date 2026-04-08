import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MapObjectType } from '@svg-map/types';
import { analyzeSvgImport, confirmSvgImport } from '../lib/api.js';
import type { SvgAnalysis, SvgAnalysisObject } from '../lib/api.js';

type ImportStep = 'upload' | 'review' | 'map' | 'confirm';

const STEPS: { key: ImportStep; label: string; number: number }[] = [
  { key: 'upload', label: 'Upload', number: 1 },
  { key: 'review', label: 'Review', number: 2 },
  { key: 'map', label: 'Map', number: 3 },
  { key: 'confirm', label: 'Confirm', number: 4 },
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
                <div style={{ fontSize: '2.5rem', marginBottom: 12, opacity: 0.4 }}>
                  &#128462;
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
            <button className="btn btn-primary" onClick={() => setStep('confirm')}>
              Next: Confirm Import
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Confirm ───────────────────────────────────────────── */}
      {step === 'confirm' && (
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 8 }}>
            Confirm Import
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>
            Review the import summary and provide project details.
          </p>

          {importError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {importError}
            </div>
          )}

          {/* Summary */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16 }}>
              Import Summary
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 12,
              }}
            >
              {Object.entries(typeCounts).map(([type, count]) => (
                <div
                  key={type}
                  style={{
                    padding: '12px 16px',
                    background: 'var(--color-bg)',
                    borderRadius: 8,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>
                    {type}{count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--color-bg)',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {includedMappings.length}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  Total Objects
                </div>
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
            <button className="btn btn-secondary" onClick={() => setStep('map')}>
              Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || !projectName.trim() || !floorName.trim()}
            >
              {importing ? 'Importing...' : `Import ${includedMappings.length} Objects`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
