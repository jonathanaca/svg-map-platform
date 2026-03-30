import React, { useState } from 'react';
import type { BrandConfig, ImageMetadata, RoomEntry, IconPlacement } from '@svg-map/types';
import UploadStep from './pages/UploadStep.js';
import ConfigStep from './pages/ConfigStep.js';
import RoomIdStep from './pages/RoomIdStep.js';
import PreviewStep from './pages/PreviewStep.js';
import './styles.css';

type Step = 'upload' | 'config' | 'rooms' | 'preview';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'config', label: 'Config' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'preview', label: 'Preview' },
];

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="app">
      <header className="app-header">
        <h1>SVG Map Platform</h1>
        <nav className="step-indicator">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={`step-dot ${step === s.key ? 'active' : ''} ${i < currentIndex ? 'done' : ''}`}
            >
              {i + 1}. {s.label}
            </span>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {step === 'upload' && (
          <UploadStep
            onComplete={(id, _url, metadata) => {
              setJobId(id);
              setImageMetadata(metadata ?? null);
              setStep('config');
            }}
          />
        )}
        {step === 'config' && jobId && (
          <ConfigStep
            jobId={jobId}
            initialConfig={brandConfig}
            onComplete={(config) => {
              setBrandConfig(config);
              setStep('rooms');
            }}
            onBack={() => setStep('upload')}
          />
        )}
        {step === 'rooms' && jobId && brandConfig && (
          <RoomIdStep
            jobId={jobId}
            brandConfig={brandConfig}
            onComplete={(rooms, icons) => {
              setBrandConfig(prev => prev ? { ...prev, roomIds: rooms, iconPlacements: icons } : prev);
              setStep('preview');
            }}
            onBack={() => setStep('config')}
          />
        )}
        {step === 'preview' && jobId && (
          <PreviewStep jobId={jobId} onBack={() => setStep('rooms')} />
        )}
      </main>
    </div>
  );
}
