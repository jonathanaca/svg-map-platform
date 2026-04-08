import React, { useState, useCallback, useRef } from 'react';
import type { MapObject, MapObjectType, PlaceOSEntityType } from '@svg-map/types';

interface Props {
  selectedObjects: MapObject[];
  allObjects: MapObject[];
  onBulkUpdate: (ids: string[], updates: Partial<MapObject>) => void;
  onAutoNumber: (prefix: string, startFrom: number) => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
}

const OBJECT_TYPES: MapObjectType[] = [
  'room', 'desk', 'zone', 'area', 'amenity', 'decorative', 'parking', 'locker',
];

const ENTITY_TYPES: (PlaceOSEntityType | '')[] = ['', 'system', 'module', 'zone'];

export default function LabellingPanel({
  selectedObjects,
  allObjects,
  onBulkUpdate,
  onAutoNumber,
  onExportCsv,
  onImportCsv,
}: Props) {
  const [bulkType, setBulkType] = useState<MapObjectType | ''>('');
  const [bulkEntityType, setBulkEntityType] = useState<PlaceOSEntityType | ''>('');
  const [bulkEntityId, setBulkEntityId] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [autoPrefix, setAutoPrefix] = useState('desk-');
  const [autoStart, setAutoStart] = useState(1);
  const [filterType, setFilterType] = useState<MapObjectType | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedIds = selectedObjects.map((o) => o.id);

  const handleBulkType = useCallback(() => {
    if (!bulkType || selectedIds.length === 0) return;
    onBulkUpdate(selectedIds, { object_type: bulkType });
  }, [bulkType, selectedIds, onBulkUpdate]);

  const handleBulkEntity = useCallback(() => {
    if (selectedIds.length === 0) return;
    onBulkUpdate(selectedIds, {
      entity_type: bulkEntityType === '' ? null : bulkEntityType,
      entity_id: bulkEntityId || null,
    });
  }, [bulkEntityType, bulkEntityId, selectedIds, onBulkUpdate]);

  const handleBulkTags = useCallback(() => {
    if (selectedIds.length === 0) return;
    const tags = bulkTags.trim()
      ? bulkTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
    onBulkUpdate(selectedIds, { tags });
  }, [bulkTags, selectedIds, onBulkUpdate]);

  const handleAutoNumber = useCallback(() => {
    onAutoNumber(autoPrefix, autoStart);
  }, [autoPrefix, autoStart, onAutoNumber]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImportCsv(file);
        e.target.value = '';
      }
    },
    [onImportCsv],
  );

  const handleSelectByType = useCallback(() => {
    if (!filterType) return;
    const ids = allObjects
      .filter((o) => o.object_type === filterType)
      .map((o) => o.id);
    if (ids.length > 0) {
      onBulkUpdate(ids, {}); // signal selection, no actual update
    }
  }, [filterType, allObjects, onBulkUpdate]);

  // Summary of selected object types
  const typeCounts: Record<string, number> = {};
  for (const obj of selectedObjects) {
    typeCounts[obj.object_type] = (typeCounts[obj.object_type] || 0) + 1;
  }

  return (
    <div className="lbl-panel">
      <div className="lbl-header">
        <h3>Data Labelling</h3>
        <span className="lbl-count">
          {selectedObjects.length} selected
        </span>
      </div>

      {/* Selection summary */}
      {selectedObjects.length > 0 && (
        <div className="lbl-summary">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span key={type} className="lbl-tag">
              {count} {type}{count > 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Select all by type */}
      <div className="lbl-section">
        <div className="lbl-section-title">Select by Type</div>
        <div className="lbl-row">
          <select
            className="form-input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as MapObjectType | '')}
          >
            <option value="">-- Choose type --</option>
            {OBJECT_TYPES.map((t) => {
              const count = allObjects.filter((o) => o.object_type === t).length;
              return (
                <option key={t} value={t}>
                  {t} ({count})
                </option>
              );
            })}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!filterType}
            onClick={handleSelectByType}
          >
            Select All
          </button>
        </div>
      </div>

      {/* Bulk set type */}
      <div className="lbl-section">
        <div className="lbl-section-title">Bulk Set Type</div>
        <div className="lbl-row">
          <select
            className="form-input"
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value as MapObjectType | '')}
          >
            <option value="">-- Choose type --</option>
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-sm"
            disabled={!bulkType || selectedIds.length === 0}
            onClick={handleBulkType}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Bulk set entity binding */}
      <div className="lbl-section">
        <div className="lbl-section-title">Bulk Entity Binding</div>
        <div className="lbl-field">
          <select
            className="form-input"
            value={bulkEntityType}
            onChange={(e) => setBulkEntityType(e.target.value as PlaceOSEntityType | '')}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t || '-- None --'}</option>
            ))}
          </select>
        </div>
        <div className="lbl-row">
          <input
            type="text"
            className="form-input"
            value={bulkEntityId}
            onChange={(e) => setBulkEntityId(e.target.value)}
            placeholder="Entity ID"
            disabled={!bulkEntityType}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={selectedIds.length === 0}
            onClick={handleBulkEntity}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Bulk set tags */}
      <div className="lbl-section">
        <div className="lbl-section-title">Bulk Set Tags</div>
        <div className="lbl-row">
          <input
            type="text"
            className="form-input"
            value={bulkTags}
            onChange={(e) => setBulkTags(e.target.value)}
            placeholder="tag1, tag2, ..."
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={selectedIds.length === 0}
            onClick={handleBulkTags}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Auto-number */}
      <div className="lbl-section">
        <div className="lbl-section-title">Auto-Number</div>
        <div className="lbl-row">
          <input
            type="text"
            className="form-input"
            value={autoPrefix}
            onChange={(e) => setAutoPrefix(e.target.value)}
            placeholder="Prefix (e.g. desk-)"
            style={{ flex: 2 }}
          />
          <input
            type="number"
            className="form-input"
            value={autoStart}
            min={0}
            onChange={(e) => setAutoStart(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>
        <button
          className="btn btn-primary btn-sm"
          disabled={selectedIds.length === 0}
          onClick={handleAutoNumber}
          style={{ marginTop: 6, width: '100%' }}
        >
          Generate Sequential IDs
        </button>
      </div>

      {/* CSV Export / Import */}
      <div className="lbl-section">
        <div className="lbl-section-title">CSV Import / Export</div>
        <div className="lbl-row">
          <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onExportCsv}>
            Export CSV
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ flex: 1 }}
            onClick={() => fileInputRef.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </div>
    </div>
  );
}
