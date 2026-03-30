import React from 'react';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

interface ColorPickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export default function ColorPicker({ id, label, value, onChange }: ColorPickerProps) {
  const isValid = HEX_REGEX.test(value);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value;
    if (raw && !raw.startsWith('#')) {
      raw = '#' + raw;
    }
    onChange(raw);
  }

  function handleSwatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
  }

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="color-picker">
        <div
          className="color-swatch"
          style={{ backgroundColor: isValid ? value : '#ffffff' }}
        >
          <input
            type="color"
            value={isValid ? value : '#ffffff'}
            onChange={handleSwatchChange}
            aria-label={`${label} color swatch`}
            tabIndex={-1}
          />
        </div>
        <input
          id={id}
          type="text"
          className={`form-input ${!isValid && value.length > 0 ? 'invalid' : ''}`}
          value={value}
          onChange={handleTextChange}
          placeholder="#000000"
          maxLength={7}
        />
        {!isValid && value.length > 0 && (
          <span className="validation-hint" role="alert">
            Invalid hex
          </span>
        )}
      </div>
    </div>
  );
}
