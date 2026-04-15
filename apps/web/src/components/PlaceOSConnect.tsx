import React, { useState, useEffect } from 'react';
import { getPlaceOSConfig, setPlaceOSConfig, testPlaceOSConnection, getPlaceOSZones, getPlaceOSSystems, type PlaceOSZone, type PlaceOSSystem } from '../lib/api.js';

interface Props {
  onConnected?: () => void;
}

export default function PlaceOSConnect({ onConnected }: Props) {
  const [domain, setDomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const [buildings, setBuildings] = useState<PlaceOSZone[]>([]);
  const [levels, setLevels] = useState<PlaceOSZone[]>([]);
  const [systems, setSystems] = useState<PlaceOSSystem[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Check existing config on mount
  useEffect(() => {
    getPlaceOSConfig().then(config => {
      if (config.configured) {
        setDomain(config.domain);
        setStatus('loading');
        testPlaceOSConnection().then(result => {
          if (result.ok && result.user) {
            setUser(result.user);
            setStatus('connected');
            loadBuildings();
          } else {
            setStatus('idle');
          }
        });
      }
    }).catch(() => {});
  }, []);

  async function handleConnect() {
    if (!domain || !apiKey) return;
    setStatus('loading');
    setError('');
    try {
      await setPlaceOSConfig(domain, apiKey);
      const result = await testPlaceOSConnection();
      if (result.ok && result.user) {
        setUser(result.user);
        setStatus('connected');
        await loadBuildings();
        onConnected?.();
      } else {
        setStatus('error');
        setError(result.error ?? 'Connection failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  async function loadBuildings() {
    try {
      const blds = await getPlaceOSZones('building');
      setBuildings(blds);
    } catch { /* ignore */ }
  }

  async function handleBuildingSelect(buildingId: string) {
    setSelectedBuilding(buildingId);
    setSelectedLevel('');
    setSystems([]);
    if (!buildingId) { setLevels([]); return; }
    try {
      const lvls = await getPlaceOSZones('level', buildingId);
      setLevels(lvls);
    } catch { setLevels([]); }
  }

  async function handleLevelSelect(levelId: string) {
    setSelectedLevel(levelId);
    if (!levelId) { setSystems([]); return; }
    try {
      const syss = await getPlaceOSSystems(levelId);
      setSystems(syss);
    } catch { setSystems([]); }
  }

  if (status !== 'connected') {
    return (
      <div style={{ padding: 20 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>Connect to PlaceOS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Domain (e.g. https://placeos-dev.aca.im)"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem' }}
          />
          <input
            type="password"
            placeholder="API Key"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem' }}
          />
          <button
            onClick={handleConnect}
            disabled={status === 'loading' || !domain || !apiKey}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6,
              background: 'var(--color-primary)', color: 'white', fontWeight: 600,
              fontSize: '0.82rem', cursor: 'pointer', opacity: status === 'loading' ? 0.6 : 1,
            }}
          >
            {status === 'loading' ? 'Connecting...' : 'Connect'}
          </button>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem' }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
          Connected to PlaceOS
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
          {user?.name}
        </span>
      </div>

      {/* Building selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Building
        </label>
        <select
          value={selectedBuilding}
          onChange={e => handleBuildingSelect(e.target.value)}
          style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-surface)' }}
        >
          <option value="">Select building...</option>
          {buildings.map(b => (
            <option key={b.id} value={b.id}>{b.display_name || b.name}</option>
          ))}
        </select>
      </div>

      {/* Level selector */}
      {selectedBuilding && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Level
          </label>
          <select
            value={selectedLevel}
            onChange={e => handleLevelSelect(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.82rem', background: 'var(--color-surface)' }}
          >
            <option value="">Select level...</option>
            {levels.map(l => (
              <option key={l.id} value={l.id}>
                {l.display_name || l.name} {l.map_id ? '(has map)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Systems list */}
      {selectedLevel && systems.length > 0 && (
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Systems ({systems.length})
          </label>
          <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            {systems.map(s => (
              <div key={s.id} style={{
                padding: '6px 10px', borderBottom: '1px solid var(--color-border)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: s.bookable ? '#22c55e' : '#94a3b8',
                }} />
                <span style={{ flex: 1, fontWeight: 500 }}>{s.display_name || s.name}</span>
                {s.map_id && (
                  <code style={{ fontSize: '0.68rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: 3, color: '#64748b' }}>
                    {s.map_id}
                  </code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedLevel && systems.length === 0 && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
          No systems found on this level.
        </p>
      )}
    </div>
  );
}

export { PlaceOSConnect };
