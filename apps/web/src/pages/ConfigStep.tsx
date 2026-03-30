import React, { useState } from 'react';
import type { BrandConfig, IconStyle } from '@svg-map/types';
import { saveConfig } from '../lib/api.js';
import ColorPicker from '../components/ColorPicker.js';

interface ConfigStepProps {
  jobId: string;
  initialConfig: BrandConfig | null;
  onComplete: (config: BrandConfig) => void;
  onBack: () => void;
}

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

export default function ConfigStep({ jobId, initialConfig, onComplete, onBack }: ConfigStepProps) {
  const [primaryColor, setPrimaryColor] = useState(initialConfig?.primaryColor ?? '#3b82f6');
  const [backgroundColor, setBackgroundColor] = useState(initialConfig?.backgroundColor ?? '#f8fafc');
  const [textColor, setTextColor] = useState(initialConfig?.textColor ?? '#1e293b');
  const [accentColor, setAccentColor] = useState(initialConfig?.accentColor ?? '#22c55e');
  const [badgeColor, setBadgeColor] = useState(initialConfig?.badgeColor ?? '');
  const [clientName, setClientName] = useState(initialConfig?.clientName ?? '');
  const [levelName, setLevelName] = useState(initialConfig?.levelName ?? '');
  const [iconStyle, setIconStyle] = useState<IconStyle>(initialConfig?.iconStyle ?? 'filled');
  const [showShadow, setShowShadow] = useState(initialConfig?.showShadow ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function colorsValid(): boolean {
    const required = [primaryColor, backgroundColor, textColor, accentColor];
    if (!required.every((c) => HEX_REGEX.test(c))) return false;
    if (badgeColor && !HEX_REGEX.test(badgeColor)) return false;
    return true;
  }

  function formValid(): boolean {
    return colorsValid() && clientName.trim().length > 0 && levelName.trim().length > 0;
  }

  async function handleSave() {
    if (!formValid()) return;

    setError(null);
    setSaving(true);

    const config: BrandConfig = {
      primaryColor,
      backgroundColor,
      textColor,
      accentColor,
      ...(badgeColor ? { badgeColor } : {}),
      clientName: clientName.trim(),
      levelName: levelName.trim(),
      iconStyle,
      showShadow,
      roomIds: initialConfig?.roomIds ?? [],
    };

    try {
      await saveConfig(jobId, config);
      onComplete(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h2>Brand Configuration</h2>
      <p className="subtitle">Customize the look and feel of your SVG map.</p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-grid">
        <ColorPicker id="primaryColor" label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
        <ColorPicker id="backgroundColor" label="Background Color" value={backgroundColor} onChange={setBackgroundColor} />
        <ColorPicker id="textColor" label="Text Color" value={textColor} onChange={setTextColor} />
        <ColorPicker id="accentColor" label="Accent Color" value={accentColor} onChange={setAccentColor} />
        <ColorPicker id="badgeColor" label="Badge Color (optional)" value={badgeColor} onChange={setBadgeColor} />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '24px 0' }} />

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="clientName">Client Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input
            id="clientName"
            type="text"
            className="form-input"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Acme Corp"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="levelName">Level Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input
            id="levelName"
            type="text"
            className="form-input"
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            placeholder="Level 1"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="iconStyle">Icon Style</label>
          <select
            id="iconStyle"
            className="form-input"
            value={iconStyle}
            onChange={(e) => setIconStyle(e.target.value as IconStyle)}
          >
            <option value="filled">Filled</option>
            <option value="outline">Outline</option>
          </select>
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div className="checkbox-group">
            <input
              id="showShadow"
              type="checkbox"
              checked={showShadow}
              onChange={(e) => setShowShadow(e.target.checked)}
            />
            <label htmlFor="showShadow">Show Shadow</label>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={onBack} type="button">
          Back
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!formValid() || saving}
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
