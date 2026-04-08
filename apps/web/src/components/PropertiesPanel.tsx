import React, { useState, useCallback } from 'react';
import type { MapObject, MapObjectType, PlaceOSEntityType } from '@svg-map/types';

interface Props {
  object: MapObject | null;
  onChange: (id: string, updates: Partial<MapObject>) => void;
  onDelete: (id: string) => void;
}

const OBJECT_TYPES: MapObjectType[] = [
  'room', 'desk', 'zone', 'area', 'amenity', 'decorative', 'parking', 'locker',
];

const ENTITY_TYPES: (PlaceOSEntityType | '')[] = ['', 'system', 'module', 'zone'];

function generateSvgId(type: MapObjectType, label: string | null): string {
  const base = label
    ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    : 'unnamed';
  return `${type}-${base}`;
}

export default function PropertiesPanel({ object, onChange, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleChange = useCallback(
    (field: string, value: unknown) => {
      if (!object) return;
      const updates: Partial<MapObject> = {};

      if (field === 'label' || field === 'svg_id' || field === 'entity_id' || field === 'layer' || field === 'group_id') {
        (updates as Record<string, unknown>)[field] = value as string;
      } else if (field === 'object_type') {
        updates.object_type = value as MapObjectType;
      } else if (field === 'entity_type') {
        updates.entity_type = (value === '' ? null : value) as PlaceOSEntityType | null;
      } else if (field === 'fill_color' || field === 'stroke_color') {
        (updates as Record<string, unknown>)[field] = value as string || null;
      } else if (field === 'opacity') {
        updates.opacity = Number(value);
      } else if (field === 'capacity') {
        updates.capacity = value === '' ? null : Number(value);
      } else if (field === 'locked') {
        updates.locked = value as boolean;
      } else if (field === 'tags') {
        const str = value as string;
        updates.tags = str.trim() ? str.split(',').map((t) => t.trim()).filter(Boolean) : [];
      } else if (field === 'x' || field === 'y' || field === 'width' || field === 'height' || field === 'rotation') {
        updates.geometry = {
          ...object.geometry,
          [field]: Number(value),
        };
      }

      onChange(object.id, updates);
    },
    [object, onChange],
  );

  const handleDelete = useCallback(() => {
    if (!object) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(object.id);
    setConfirmDelete(false);
  }, [object, confirmDelete, onDelete]);

  if (!object) {
    return (
      <div className="pp-panel">
        <div className="pp-empty">
          <span className="pp-empty-icon">&#9432;</span>
          <p>Select an object on the canvas to view its properties.</p>
        </div>
      </div>
    );
  }

  const { geometry } = object;
  const tagsStr = (object.tags ?? []).join(', ');

  return (
    <div className="pp-panel">
      <div className="pp-header">
        <h3>Properties</h3>
        <span className="pp-type-badge">{object.object_type}</span>
      </div>

      <div className="pp-scroll">
        {/* Label */}
        <div className="pp-field">
          <label>Label</label>
          <input
            type="text"
            className="form-input"
            value={object.label ?? ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Enter label..."
          />
        </div>

        {/* Object Type */}
        <div className="pp-field">
          <label>Object Type</label>
          <select
            className="form-input"
            value={object.object_type}
            onChange={(e) => handleChange('object_type', e.target.value)}
          >
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* SVG ID */}
        <div className="pp-field">
          <label>SVG ID</label>
          <div className="pp-row">
            <input
              type="text"
              className="form-input"
              value={object.svg_id ?? ''}
              onChange={(e) => handleChange('svg_id', e.target.value)}
              placeholder={generateSvgId(object.object_type, object.label)}
            />
            <button
              className="btn btn-secondary btn-sm"
              title="Auto-generate from type + label"
              onClick={() => handleChange('svg_id', generateSvgId(object.object_type, object.label))}
            >
              Auto
            </button>
          </div>
        </div>

        {/* Position */}
        <div className="pp-field">
          <label>Position</label>
          <div className="pp-grid-2">
            <div className="pp-mini-field">
              <span>X</span>
              <input
                type="number"
                className="form-input"
                value={geometry.x ?? 0}
                readOnly
              />
            </div>
            <div className="pp-mini-field">
              <span>Y</span>
              <input
                type="number"
                className="form-input"
                value={geometry.y ?? 0}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div className="pp-field">
          <label>Size</label>
          <div className="pp-grid-2">
            <div className="pp-mini-field">
              <span>W</span>
              <input
                type="number"
                className="form-input"
                value={geometry.width ?? 0}
                min={1}
                onChange={(e) => handleChange('width', e.target.value)}
              />
            </div>
            <div className="pp-mini-field">
              <span>H</span>
              <input
                type="number"
                className="form-input"
                value={geometry.height ?? 0}
                min={1}
                onChange={(e) => handleChange('height', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="pp-field">
          <label>Rotation</label>
          <div className="pp-row">
            <input
              type="number"
              className="form-input"
              value={geometry.rotation ?? 0}
              min={0}
              max={360}
              onChange={(e) => handleChange('rotation', e.target.value)}
            />
            <span className="pp-unit">deg</span>
          </div>
        </div>

        {/* Capacity (rooms only) */}
        {object.object_type === 'room' && (
          <div className="pp-field">
            <label>Capacity</label>
            <input
              type="number"
              className="form-input"
              value={object.capacity ?? ''}
              min={0}
              placeholder="0"
              onChange={(e) => handleChange('capacity', e.target.value)}
            />
          </div>
        )}

        {/* Fill Color */}
        <div className="pp-field">
          <label>Fill Color</label>
          <div className="pp-color-row">
            <input
              type="color"
              value={object.fill_color || '#cccccc'}
              onChange={(e) => handleChange('fill_color', e.target.value)}
              className="pp-color-input"
            />
            <input
              type="text"
              className="form-input"
              value={object.fill_color ?? ''}
              onChange={(e) => handleChange('fill_color', e.target.value)}
              placeholder="#cccccc"
              maxLength={7}
            />
          </div>
        </div>

        {/* Stroke Color */}
        <div className="pp-field">
          <label>Stroke Color</label>
          <div className="pp-color-row">
            <input
              type="color"
              value={object.stroke_color || '#333333'}
              onChange={(e) => handleChange('stroke_color', e.target.value)}
              className="pp-color-input"
            />
            <input
              type="text"
              className="form-input"
              value={object.stroke_color ?? ''}
              onChange={(e) => handleChange('stroke_color', e.target.value)}
              placeholder="#333333"
              maxLength={7}
            />
          </div>
        </div>

        {/* Opacity */}
        <div className="pp-field">
          <label>Opacity <span className="pp-unit">{Math.round(object.opacity * 100)}%</span></label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={object.opacity}
            onChange={(e) => handleChange('opacity', e.target.value)}
            className="pp-slider"
          />
        </div>

        <div className="pp-separator" />

        {/* PlaceOS Binding */}
        <div className="pp-section-title">PlaceOS Binding</div>

        <div className="pp-field">
          <label>Entity Type</label>
          <select
            className="form-input"
            value={object.entity_type ?? ''}
            onChange={(e) => handleChange('entity_type', e.target.value)}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t || '-- None --'}</option>
            ))}
          </select>
        </div>

        <div className="pp-field">
          <label>Entity ID</label>
          <input
            type="text"
            className="form-input"
            value={object.entity_id ?? ''}
            onChange={(e) => handleChange('entity_id', e.target.value)}
            placeholder="sys-XXXXXXXX"
            disabled={!object.entity_type}
          />
        </div>

        {/* Tags */}
        <div className="pp-field">
          <label>Tags</label>
          <input
            type="text"
            className="form-input"
            value={tagsStr}
            onChange={(e) => handleChange('tags', e.target.value)}
            placeholder="tag1, tag2, ..."
          />
        </div>

        {/* Locked */}
        <div className="pp-field">
          <div className="checkbox-group">
            <input
              type="checkbox"
              id="pp-locked"
              checked={object.locked}
              onChange={(e) => handleChange('locked', e.target.checked)}
            />
            <label htmlFor="pp-locked">Locked</label>
          </div>
        </div>

        {/* Delete */}
        <div className="pp-delete-section">
          <button
            className={`btn btn-sm ${confirmDelete ? 'btn-danger' : 'btn-secondary'}`}
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            style={{ width: '100%' }}
          >
            {confirmDelete ? 'Confirm Delete' : 'Delete Object'}
          </button>
        </div>
      </div>
    </div>
  );
}
