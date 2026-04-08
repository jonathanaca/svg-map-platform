import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Floorplan } from '@svg-map/types';
import { getProject, addFloorplan } from '../lib/api.js';

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
          <StatusBadge status={project.status} />
        </div>
      </div>

      {/* Floorplans header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          Floorplans ({floorplans.length})
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Floor'}
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
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/editor/${fp.id}`)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
