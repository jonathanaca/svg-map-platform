import React, { useState, useEffect } from 'react';
import { getPlaceOSConfig, setPlaceOSConfig, testPlaceOSConnection } from '../lib/api.js';

export default function SettingsPage() {
  const [domain, setDomain] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPlaceOSConfig().then(cfg => {
      if (cfg.configured) {
        setDomain(cfg.domain);
        setStatus('loading');
        testPlaceOSConnection().then(r => {
          if (r.ok && r.user) {
            setUser(r.user);
            setStatus('connected');
          } else {
            setStatus('idle');
          }
        });
      }
    }).catch(() => {});
  }, []);

  async function handleSave() {
    if (!domain || !apiKey) return;
    setStatus('loading');
    setError('');
    setSaved(false);
    try {
      await setPlaceOSConfig(domain, apiKey);
      const result = await testPlaceOSConnection();
      if (result.ok && result.user) {
        setUser(result.user);
        setStatus('connected');
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setStatus('error');
        setError(result.error ?? 'Connection failed');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 24 }}>Settings</h2>

      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>PlaceOS Connection</h3>
          {status === 'connected' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: '0.75rem', fontWeight: 600, color: '#16a34a',
              background: '#f0fdf4', padding: '4px 10px', borderRadius: 99,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Connected
            </span>
          )}
        </div>

        {status === 'connected' && user && (
          <div style={{
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: 12, marginBottom: 16, fontSize: '0.82rem',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{user.name}</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>{user.email}</div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.72rem', marginTop: 4 }}>{domain}</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              PlaceOS Domain
            </label>
            <input
              type="text"
              placeholder="https://placeos-dev.aca.im"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: '0.85rem', background: 'var(--color-surface)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              API Key
            </label>
            <input
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid var(--color-border)', borderRadius: 6,
                fontSize: '0.85rem', background: 'var(--color-surface)',
              }}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={status === 'loading' || !domain || !apiKey}
            style={{
              padding: '10px 16px', border: 'none', borderRadius: 6,
              background: status === 'loading' ? '#9ca3af' : 'var(--color-primary)',
              color: 'white', fontWeight: 600, fontSize: '0.85rem',
              cursor: status === 'loading' ? 'wait' : 'pointer',
              marginTop: 4,
            }}
          >
            {status === 'loading' ? 'Connecting...' : status === 'connected' ? 'Update Connection' : 'Connect'}
          </button>
          {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: '#16a34a', fontSize: '0.78rem', margin: 0 }}>Connection saved successfully.</p>}
        </div>
      </div>
    </div>
  );
}
