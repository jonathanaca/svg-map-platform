import React, { useState, useCallback } from 'react';
import type { EditorLayer } from '@svg-map/types';

interface Props {
  layers: EditorLayer[];
  activeLayer: string;
  onLayerChange: (layers: EditorLayer[]) => void;
  onActiveLayerChange: (layerId: string) => void;
  onAddLayer: (name: string) => void;
  onDeleteLayer: (id: string) => void;
}

export const DEFAULT_LAYERS: EditorLayer[] = [
  { id: 'background', name: 'Background', visible: true, locked: false, opacity: 1, order: 0 },
  { id: 'walls',      name: 'Walls',      visible: true, locked: false, opacity: 1, order: 1 },
  { id: 'rooms',      name: 'Rooms',      visible: true, locked: false, opacity: 1, order: 2 },
  { id: 'desks',      name: 'Desks',      visible: true, locked: false, opacity: 1, order: 3 },
  { id: 'lockers',    name: 'Lockers',    visible: true, locked: false, opacity: 1, order: 4 },
  { id: 'zones',      name: 'Zones',      visible: true, locked: false, opacity: 1, order: 5 },
  { id: 'amenities',  name: 'Amenities',  visible: true, locked: false, opacity: 1, order: 6 },
  { id: 'labels',     name: 'Labels',     visible: true, locked: false, opacity: 1, order: 7 },
];

export default function LayerPanel({
  layers,
  activeLayer,
  onLayerChange,
  onActiveLayerChange,
  onAddLayer,
  onDeleteLayer,
}: Props) {
  const [newLayerName, setNewLayerName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sorted = [...layers].sort((a, b) => a.order - b.order);

  const updateLayer = useCallback(
    (id: string, updates: Partial<EditorLayer>) => {
      const updated = layers.map((l) => (l.id === id ? { ...l, ...updates } : l));
      onLayerChange(updated);
    },
    [layers, onLayerChange],
  );

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = sorted.findIndex((l) => l.id === id);
      if (idx < 0) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return;

      const updated = layers.map((l) => {
        if (l.id === sorted[idx].id) return { ...l, order: sorted[swapIdx].order };
        if (l.id === sorted[swapIdx].id) return { ...l, order: sorted[idx].order };
        return l;
      });
      onLayerChange(updated);
    },
    [layers, sorted, onLayerChange],
  );

  const handleAdd = useCallback(() => {
    const name = newLayerName.trim() || `Layer ${layers.length + 1}`;
    onAddLayer(name);
    setNewLayerName('');
  }, [newLayerName, layers.length, onAddLayer]);

  const handleDelete = useCallback(
    (id: string) => {
      if (confirmDeleteId !== id) {
        setConfirmDeleteId(id);
        return;
      }
      onDeleteLayer(id);
      setConfirmDeleteId(null);
    },
    [confirmDeleteId, onDeleteLayer],
  );

  return (
    <div className="lp-panel">
      <div className="lp-header">
        <h3>Layers</h3>
        <span className="lp-count">{layers.length}</span>
      </div>

      <div className="lp-list">
        {sorted.map((layer, idx) => {
          const isActive = layer.id === activeLayer;
          return (
            <div
              key={layer.id}
              className={`lp-item ${isActive ? 'lp-item--active' : ''}`}
              onClick={() => onActiveLayerChange(layer.id)}
            >
              <div className="lp-item-main">
                {/* Visibility toggle */}
                <button
                  className={`lp-icon-btn ${layer.visible ? '' : 'lp-icon-btn--off'}`}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { visible: !layer.visible });
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {layer.visible
                      ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    }
                  </svg>
                </button>

                {/* Lock toggle */}
                <button
                  className={`lp-icon-btn ${layer.locked ? 'lp-icon-btn--on' : ''}`}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { locked: !layer.locked });
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {layer.locked
                      ? <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                      : <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
                    }
                  </svg>
                </button>

                <span className="lp-item-name">{layer.name}</span>
              </div>

              <div className="lp-item-actions">
                {/* Opacity slider */}
                <input
                  type="range"
                  className="lp-opacity-slider"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { opacity: Number(e.target.value) });
                  }}
                />

                {/* Reorder */}
                <button
                  className="lp-icon-btn"
                  disabled={idx === 0}
                  title="Move up"
                  onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }}
                >
                  &#9650;
                </button>
                <button
                  className="lp-icon-btn"
                  disabled={idx === sorted.length - 1}
                  title="Move down"
                  onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); }}
                >
                  &#9660;
                </button>

                {/* Delete */}
                <button
                  className={`lp-icon-btn ${confirmDeleteId === layer.id ? 'lp-icon-btn--danger' : ''}`}
                  title="Delete layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(layer.id);
                  }}
                  onBlur={() => setConfirmDeleteId(null)}
                >
                  &#10005;
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add layer */}
      <div className="lp-add">
        <input
          type="text"
          className="form-input"
          value={newLayerName}
          onChange={(e) => setNewLayerName(e.target.value)}
          placeholder="New layer name..."
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          + Add Layer
        </button>
      </div>
    </div>
  );
}
