import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '@svg-map/types';
import { listProjects, createProject, deleteProject } from '../lib/api.js';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: Project['status'] }) {
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

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formBuilding, setFormBuilding] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    setCreating(true);
    try {
      await createProject(formName.trim(), formBuilding.trim() || undefined);
      setFormName('');
      setFormBuilding('');
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Projects</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Manage your floor plan projects
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/import')}>
            Import SVG
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Project'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 24 }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Project Name *</label>
              <input
                className="form-input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Sydney HQ"
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label>Building Name</label>
              <input
                className="form-input"
                value={formBuilding}
                onChange={(e) => setFormBuilding(e.target.value)}
                placeholder="e.g. Tower A"
              />
            </div>
          </div>
          <div className="form-actions">
            <div />
            <button className="btn btn-primary" type="submit" disabled={creating || !formName.trim()}>
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="status-container">
          <div className="spinner" />
          <p className="status-label">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>No projects yet</p>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
            Create your first project to start designing floor plans.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + New Project
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
          }}
        >
          {projects.map((project) => (
            <div
              key={project.id}
              className="card"
              style={{ padding: 20, cursor: 'pointer', transition: 'box-shadow 150ms ease' }}
              onClick={() => navigate(`/project/${project.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--shadow)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.name}
                  </h3>
                  {project.building_name && (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                      {project.building_name}
                    </p>
                  )}
                </div>
                <StatusBadge status={project.status} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  <span>{project.floorplans?.length ?? 0} floor{(project.floorplans?.length ?? 0) !== 1 ? 's' : ''}</span>
                  <span>Updated {formatDate(project.updated_at)}</span>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--color-danger)' }}
                  onClick={(e) => handleDelete(e, project.id, project.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
