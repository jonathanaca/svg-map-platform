import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Floorplan } from '@svg-map/types';
import { getProject, addFloorplan, deleteFloorplan } from '../lib/api.js';
import PlaceOSConnect from '../components/PlaceOSConnect.js';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    draft: { bg: 'var(--color-bg)', color: 'var(--color-text-secondary)' },
    published: { bg: 'var(--color-success-light)', color: '#16a34a' },
    archived: { bg: '#fef3c7', color: '#92400e' },
  };
  const s = colors[status] ?? colors.draft;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        fontSize: '0.72rem',
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [floorName, setFloorName] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(id);
      setProject(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleAddFloor(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !floorName.trim()) return;
    setCreating(true);
    try {
      const floorIndex = (project?.floorplans?.length ?? 0);
      await addFloorplan(id, floorName.trim(), floorIndex);
      setFloorName('');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add floorplan');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="status-container">
        <div className="spinner" />
        <p className="status-label">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="alert alert-error">{error ?? 'Project not found'}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to Projects</button>
      </div>
    );
  }

  const floorplans: Floorplan[] = project.floorplans ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 16 }}
          onClick={() => navigate('/')}
        >
          &larr; Back to Projects
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>{project.name}</h2>
            {project.building_name && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                {project.building_name}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-sm"
              style={{ background: '#ffffff', color: '#3b82f6', border: '1px solid #e2e8f0', fontWeight: 600 }}
              onClick={() => navigate(`/kiosk/${project.id}`)}
            >
              View Kiosk
            </button>
            <StatusBadge status={project.status} />
          </div>
        </div>
      </div>

      {/* Quote requirements banner (from wmquote import) */}
      {(() => {
        try {
          const meta = project.metadata ? JSON.parse(project.metadata as string) : null;
          if (!meta?.source || meta.source !== 'wmquote') return null;
          const req = meta.requirements || meta;
          const rooms = req.rooms ?? req.num_rooms ?? 0;
          const desks = req.desks ?? req.num_desks ?? 0;
          const lockers = req.lockers ?? req.num_lockers ?? 0;
          const carspaces = req.carspaces ?? req.num_carspaces ?? 0;
          if (!rooms && !desks && !lockers && !carspaces) return null;
          const steps = [
            { num: '1', title: 'Upload Floor Plan', desc: 'Click on a floor below, then use Upload Image to import your architectural drawing' },
            { num: '2', title: 'Draw Outline', desc: 'Use the Draw Outline tool to trace the floor boundary' },
            { num: '3', title: 'Map Each Layer', desc: 'Select a layer (Rooms, Desks, Lockers, Zones) and use Rect or Place tool to draw — objects are auto-labelled, click the name to rename' },
          ];
          return (
            <div className="card" style={{ marginBottom: 20, padding: 24, borderLeft: '4px solid #4a90d9', background: 'linear-gradient(135deg, #f0f7ff 0%, #fff 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>How to Map Your Floors</span>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 8, background: '#e8f0fb', color: '#4a90d9', fontWeight: 600 }}>from WorkMate Quote</span>
              </div>

              {/* Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
                {steps.map((s) => (
                  <div key={s.num} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{s.num}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.title}</div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Requirements summary */}
              <div style={{ padding: '12px 16px', background: '#f8f9fa', borderRadius: 8, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>To place:</span>
                {rooms > 0 && <span style={{ marginLeft: 12, padding: '3px 10px', background: '#f3f0ff', borderRadius: 6 }}><strong>{rooms}</strong> rooms</span>}
                {desks > 0 && <span style={{ marginLeft: 8, padding: '3px 10px', background: '#eff6ff', borderRadius: 6 }}><strong>{desks}</strong> desks</span>}
                {lockers > 0 && <span style={{ marginLeft: 8, padding: '3px 10px', background: '#fef2f2', borderRadius: 6 }}><strong>{lockers}</strong> lockers</span>}
                {carspaces > 0 && <span style={{ marginLeft: 8, padding: '3px 10px', background: '#ecfdf5', borderRadius: 6 }}><strong>{carspaces}</strong> car spaces</span>}
              </div>
            </div>
          );
        } catch { return null; }
      })()}

      {/* Floorplans header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          Floorplans ({floorplans.length})
        </h3>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Floor'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Add floor form */}
      {showForm && (
        <form onSubmit={handleAddFloor} className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Floor Name *</label>
              <input
                className="form-input"
                value={floorName}
                onChange={(e) => setFloorName(e.target.value)}
                placeholder="e.g. Level 3"
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={creating || !floorName.trim()}>
              {creating ? 'Adding...' : 'Add Floor'}
            </button>
          </div>
        </form>
      )}

      {/* Floor list */}
      {floorplans.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>No floorplans yet</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: 20 }}>
            Add a floor to start designing.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            + Add Floor
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {floorplans
            .sort((a, b) => a.floor_index - b.floor_index)
            .map((fp) => (
              <div key={fp.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Thumbnail area */}
                <div
                  style={{
                    height: 140,
                    background: '#e8e8e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {fp.source_image_path ? (
                    <img
                      src={`/api/floorplans/${fp.id}/source-preview`}
                      alt={fp.floor_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                      No source image
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{fp.floor_name}</h4>
                    <StatusBadge status={fp.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      v{fp.version}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--color-danger)' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete floor "${fp.floor_name}"? This cannot be undone.`)) return;
                          try {
                            await deleteFloorplan(fp.id);
                            await load();
                          } catch (err: unknown) {
                            setError(err instanceof Error ? err.message : 'Failed to delete floor');
                          }
                        }}
                      >
                        Delete
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#ffffff', color: '#3b82f6', border: '1px solid #e2e8f0', fontWeight: 600 }}
                        onClick={() => navigate(`/kiosk/${project.id}/${fp.id}`)}
                      >
                        3D View
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/editor/${fp.id}`)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* PlaceOS Integration */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 0 }}>PlaceOS Integration</h3>
        <PlaceOSConnect />
      </div>
    </div>
  );
}
