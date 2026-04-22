import React, { useState, useCallback, useRef, useMemo } from 'react';
import type { MapObject, MapObjectType, PlaceOSEntityType } from '@svg-map/types';

interface Props {
  selectedObjects: MapObject[];
  allObjects: MapObject[];
  onBulkUpdate: (ids: string[], updates: Partial<MapObject>) => void;
  onAutoNumber: (prefix: string, startFrom: number) => void;
  onExportCsv: () => void;
  onImportCsv: (file: File) => void;
  importedIds?: { id: string; label?: string; assigned?: boolean }[];
  onImportedIdsChange?: (ids: { id: string; label?: string; assigned?: boolean }[]) => void;
}

interface ImportedId {
  id: string;
  label?: string;
  type?: string;
  assigned?: boolean;
  assignedTo?: string; // object id it's assigned to
}

export default function LabellingPanel({
  selectedObjects,
  allObjects,
  onBulkUpdate,
  onAutoNumber,
  onExportCsv,
  onImportCsv,
  importedIds: externalImportedIds,
  onImportedIdsChange,
}: Props) {
  const [localImportedIds, setLocalImportedIds] = useState<ImportedId[]>([]);
  const importedIds = externalImportedIds ?? localImportedIds;
  const setImportedIds = (ids: ImportedId[] | ((prev: ImportedId[]) => ImportedId[])) => {
    const newIds = typeof ids === 'function' ? ids(importedIds) : ids;
    setLocalImportedIds(newIds);
    onImportedIdsChange?.(newIds);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'assign' | 'bulk' | 'export'>('assign');
  const [autoPrefix, setAutoPrefix] = useState('desk-');
  const [autoStart, setAutoStart] = useState(1);
  const [filterType, setFilterType] = useState<MapObjectType | ''>('');
  const [bulkType, setBulkType] = useState<MapObjectType | ''>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCsvRef = useRef<HTMLInputElement>(null);

  const selectedObj = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Filter imported IDs by search
  const filteredIds = useMemo(() => {
    if (!searchQuery.trim()) return importedIds;
    const q = searchQuery.toLowerCase();
    return importedIds.filter(item =>
      item.id.toLowerCase().includes(q) ||
      (item.label && item.label.toLowerCase().includes(q)) ||
      (item.type && item.type.toLowerCase().includes(q))
    );
  }, [importedIds, searchQuery]);

  const unassignedIds = filteredIds.filter(item => !item.assigned);
  const assignedIds = filteredIds.filter(item => item.assigned);

  // Import CSV of IDs
  const handleImportIds = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      // Check if first line is a header
      const firstLine = lines[0].toLowerCase();
      const hasHeader = firstLine.includes('id') || firstLine.includes('name') || firstLine.includes('label');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const ids: ImportedId[] = dataLines.map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        // Check if any existing object already has this ID
        const existingObj = allObjects.find(o => o.svg_id === parts[0] || o.label === parts[0]);
        return {
          id: parts[0],
          label: parts[1] || undefined,
          type: parts[2] || undefined,
          assigned: !!existingObj,
          assignedTo: existingObj?.id,
        };
      }).filter(item => item.id);

      setImportedIds(ids);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [allObjects]);

  // Assign an imported ID to the selected object
  const handleAssign = useCallback((item: ImportedId) => {
    if (!selectedObj) return;
    onBulkUpdate([selectedObj.id], {
      svg_id: item.id,
      label: item.label || item.id,
    });
    // Mark as assigned
    setImportedIds(prev => prev.map(i =>
      i.id === item.id ? { ...i, assigned: true, assignedTo: selectedObj.id } : i
    ));
  }, [selectedObj, onBulkUpdate]);

  // Unassign an ID
  const handleUnassign = useCallback((item: ImportedId) => {
    setImportedIds(prev => prev.map(i =>
      i.id === item.id ? { ...i, assigned: false, assignedTo: undefined } : i
    ));
  }, []);

  // Export all assignments as CSV
  const handleExportAssignments = useCallback(() => {
    const lines = ['svg_id,label,object_type,x,y,width,height'];
    for (const obj of allObjects) {
      if (obj.object_type === 'room' || obj.object_type === 'desk' || obj.object_type === 'zone') {
        const g = obj.geometry;
        lines.push([
          obj.svg_id || '',
          obj.label || '',
          obj.object_type,
          String(g.x ?? ''),
          String(g.y ?? ''),
          String(g.width ?? ''),
          String(g.height ?? ''),
        ].join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floorplan-ids.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [allObjects]);

  // Legacy import handler
  const handleLegacyImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) { onImportCsv(file); e.target.value = ''; }
    },
    [onImportCsv],
  );

  const handleAutoNumber = useCallback(() => {
    onAutoNumber(autoPrefix, autoStart);
  }, [autoPrefix, autoStart, onAutoNumber]);

  const handleSelectByType = useCallback(() => {
    if (!filterType) return;
    const ids = allObjects.filter(o => o.object_type === filterType).map(o => o.id);
    if (ids.length > 0) onBulkUpdate(ids, {});
  }, [filterType, allObjects, onBulkUpdate]);

  const bookableObjects = allObjects.filter(o => o.object_type === 'room' || o.object_type === 'desk');
  const assignedCount = bookableObjects.filter(o => o.svg_id && o.svg_id !== o.id).length;

  return (
    <div className="lbl-panel">
      <div className="lbl-header">
        <h3>Data Labelling</h3>
        <span className="lbl-count">{assignedCount}/{bookableObjects.length} labelled</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
        {([
          { id: 'assign' as const, label: 'Assign IDs' },
          { id: 'bulk' as const, label: 'Bulk Edit' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: activeTab === tab.id ? 'var(--color-surface)' : 'transparent',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Assign IDs Tab ── */}
      {activeTab === 'assign' && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Import CSV of IDs */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              1. Import ID list (CSV)
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, fontSize: '0.82rem' }}
                onClick={() => importCsvRef.current?.click()}
              >
                {importedIds.length > 0 ? `${importedIds.length} IDs loaded` : 'Choose CSV file'}
              </button>
              {importedIds.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.82rem', color: '#dc2626' }}
                  onClick={() => setImportedIds([])}
                >
                  Clear
                </button>
              )}
            </div>
            <input ref={importCsvRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleImportIds} />
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 3 }}>
              CSV format: id, label (optional), type (optional)
            </div>
          </div>

          {/* Step 2: Select object */}
          {importedIds.length > 0 && (
            <>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  2. Click a room/desk on canvas
                </div>
                {selectedObj ? (
                  <div style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)',
                    fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-primary)',
                  }}>
                    Selected: {selectedObj.label || selectedObj.svg_id || selectedObj.object_type}
                    <span style={{ fontSize: '0.82rem', fontWeight: 400, marginLeft: 6, opacity: 0.7 }}>
                      ({selectedObj.object_type})
                    </span>
                  </div>
                ) : (
                  <div style={{
                    padding: '6px 10px', borderRadius: 6,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    fontSize: '0.82rem', color: '#92400e',
                  }}>
                    Click a room or desk on the canvas to select it
                  </div>
                )}
              </div>

              {/* Step 3: Pick an ID */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  3. Pick an ID to assign
                </div>
                {/* Search */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search IDs..."
                  style={{
                    width: '100%', padding: '5px 8px', border: '1px solid var(--color-border)',
                    borderRadius: 6, fontSize: '0.82rem', marginBottom: 4,
                    background: 'var(--color-bg)', outline: 'none',
                  }}
                />
                {/* ID list */}
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                  {unassignedIds.length === 0 && assignedIds.length === 0 && (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                      {searchQuery ? 'No matches' : 'All IDs assigned'}
                    </div>
                  )}
                  {unassignedIds.map(item => (
                    <div
                      key={item.id}
                      onClick={() => selectedObj && handleAssign(item)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '5px 10px', borderBottom: '1px solid var(--color-border)',
                        cursor: selectedObj ? 'pointer' : 'default',
                        fontSize: '0.82rem',
                        opacity: selectedObj ? 1 : 0.5,
                        background: 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (selectedObj) (e.currentTarget.style.background = 'var(--color-primary-light)'); }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500, flex: 1 }}>{item.id}</span>
                      {item.label && <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{item.label}</span>}
                      {item.type && <span style={{ fontSize: '0.82rem', padding: '1px 4px', borderRadius: 3, background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}>{item.type}</span>}
                    </div>
                  ))}
                  {assignedIds.length > 0 && (
                    <>
                      <div style={{ padding: '4px 10px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)', background: 'var(--color-bg)', textTransform: 'uppercase' }}>
                        Assigned ({assignedIds.length})
                      </div>
                      {assignedIds.map(item => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '4px 10px', borderBottom: '1px solid var(--color-border)',
                            fontSize: '0.82rem', opacity: 0.6,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                          <span style={{ fontWeight: 500, flex: 1, textDecoration: 'line-through' }}>{item.id}</span>
                          <button
                            onClick={() => handleUnassign(item)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626', padding: '2px 4px' }}
                          >
                            undo
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Export IDs */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 10, marginTop: 4 }}>
            <button className="btn btn-primary btn-sm" style={{ width: '100%', fontSize: '0.85rem', padding: '8px 12px' }} onClick={handleExportAssignments}>
              Export IDs as CSV
            </button>
          </div>
        </div>
      )}

      {/* ── Bulk Edit Tab ── */}
      {activeTab === 'bulk' && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Select by type */}
          <div className="lbl-section">
            <div className="lbl-section-title">Select by Type</div>
            <div className="lbl-row">
              <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value as MapObjectType | '')}>
                <option value="">-- Choose type --</option>
                {(['room', 'desk', 'zone', 'area', 'amenity', 'decorative', 'parking', 'locker'] as MapObjectType[]).map(t => {
                  const count = allObjects.filter(o => o.object_type === t).length;
                  return <option key={t} value={t}>{t} ({count})</option>;
                })}
              </select>
              <button className="btn btn-secondary btn-sm" disabled={!filterType} onClick={handleSelectByType}>Select All</button>
            </div>
          </div>

          {/* Bulk set type */}
          <div className="lbl-section">
            <div className="lbl-section-title">Bulk Set Type</div>
            <div className="lbl-row">
              <select className="form-input" value={bulkType} onChange={e => setBulkType(e.target.value as MapObjectType | '')}>
                <option value="">-- Choose type --</option>
                {(['room', 'desk', 'zone', 'area', 'amenity', 'decorative', 'parking', 'locker'] as MapObjectType[]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!bulkType || selectedObjects.length === 0}
                onClick={() => { if (bulkType) onBulkUpdate(selectedObjects.map(o => o.id), { object_type: bulkType }); }}>
                Apply
              </button>
            </div>
          </div>

          {/* Auto-number */}
          <div className="lbl-section">
            <div className="lbl-section-title">Auto-Number Selected</div>
            <div className="lbl-row">
              <input type="text" className="form-input" value={autoPrefix} onChange={e => setAutoPrefix(e.target.value)} placeholder="Prefix" style={{ flex: 2 }} />
              <input type="number" className="form-input" value={autoStart} min={0} onChange={e => setAutoStart(Number(e.target.value))} style={{ flex: 1 }} />
            </div>
            <button className="btn btn-primary btn-sm" disabled={selectedObjects.length === 0} onClick={handleAutoNumber} style={{ marginTop: 4, width: '100%' }}>
              Generate Sequential IDs
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
