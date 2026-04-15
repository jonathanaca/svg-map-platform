import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import type { BrandConfig, ImageMetadata, AvailabilityState } from '@svg-map/types';
import ProjectsPage from './pages/ProjectsPage.js';
import ProjectDetailPage from './pages/ProjectDetailPage.js';
import EditorPage from './pages/EditorPage.js';
import KioskPage from './pages/KioskPage.js';
import ImportPage from './pages/ImportPage.js';
import UploadStep from './pages/UploadStep.js';
import ConfigStep from './pages/ConfigStep.js';
import RoomIdStep from './pages/RoomIdStep.js';
import PreviewStep from './pages/PreviewStep.js';
import StateStep from './pages/StateStep.js';
import './styles.css';

// ── Legacy Wizard (kept at /legacy) ─────────────────────────────────────────

type Step = 'upload' | 'config' | 'rooms' | 'states' | 'preview';

const STEPS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'config', label: 'Config' },
  { key: 'rooms', label: 'Rooms' },
  { key: 'states', label: 'States' },
  { key: 'preview', label: 'Preview' },
];

function LegacyWizard() {
  const [step, setStep] = useState<Step>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(null);
  const [stateAssignments, setStateAssignments] = useState<Record<string, AvailabilityState>>({});

  const currentIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <>
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
              setBrandConfig((prev) => (prev ? { ...prev, roomIds: rooms, iconPlacements: icons } : prev));
              setStep('states');
            }}
            onBack={() => setStep('config')}
          />
        )}
        {step === 'states' && jobId && brandConfig && (
          <StateStep
            jobId={jobId}
            brandConfig={brandConfig}
            stateAssignments={stateAssignments}
            onComplete={(assignments) => {
              setStateAssignments(assignments);
              setBrandConfig((prev) => (prev ? { ...prev, stateAssignments: assignments } : prev));
              setStep('preview');
            }}
            onBack={() => setStep('rooms')}
          />
        )}
        {step === 'preview' && jobId && (
          <PreviewStep jobId={jobId} onBack={() => setStep('states')} />
        )}
      </main>
    </>
  );
}

// ── App with Router ─────────────────────────────────────────────────────────

function StandardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1>Floor Plan Studio</h1>
        </Link>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Full-screen pages, no wrapper */}
        <Route path="/editor/:floorplanId" element={<EditorPage />} />
        <Route path="/kiosk/:projectId" element={<KioskPage />} />

        {/* Standard pages */}
        <Route path="/" element={<StandardLayout><ProjectsPage /></StandardLayout>} />
        <Route path="/project/:id" element={<StandardLayout><ProjectDetailPage /></StandardLayout>} />
        <Route path="/import" element={<StandardLayout><ImportPage /></StandardLayout>} />
        <Route path="/legacy" element={<StandardLayout><LegacyWizard /></StandardLayout>} />
      </Routes>
    </BrowserRouter>
  );
}
