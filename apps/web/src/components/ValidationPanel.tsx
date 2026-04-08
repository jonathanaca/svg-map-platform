import React, { useState, useEffect, useCallback } from 'react';
import type { ValidationIssue } from '@svg-map/types';
import { validateFloorplan } from '../lib/api.js';

interface Props {
  floorplanId: string;
  onSelectObject: (objectId: string) => void;
}

export default function ValidationPanel({ floorplanId, onSelectObject }: Props) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const runValidation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await validateFloorplan(floorplanId);
      setIssues(result);
      setHasRun(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [floorplanId]);

  const errorCount = issues.filter((i) => i.type === 'error').length;
  const warningCount = issues.filter((i) => i.type === 'warning').length;

  return (
    <div className="vp-panel">
      <div className="vp-header">
        <h3>Validation</h3>
        <button
          className="btn btn-primary btn-sm"
          onClick={runValidation}
          disabled={loading}
        >
          {loading ? 'Running...' : 'Run Validation'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {hasRun && !loading && (
        <div className="vp-summary">
          <span className={`vp-count ${errorCount > 0 ? 'vp-count--error' : 'vp-count--ok'}`}>
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
          <span className="vp-count-sep">,</span>
          <span className={`vp-count ${warningCount > 0 ? 'vp-count--warning' : 'vp-count--ok'}`}>
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </span>
        </div>
      )}

      {hasRun && issues.length === 0 && !loading && (
        <div className="vp-empty">
          <span className="vp-check-icon">&#10003;</span>
          <p>No issues found. Floorplan is valid.</p>
        </div>
      )}

      <div className="vp-list">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={`vp-issue vp-issue--${issue.type}`}
            onClick={() => issue.objectId && onSelectObject(issue.objectId)}
            style={{ cursor: issue.objectId ? 'pointer' : 'default' }}
            role={issue.objectId ? 'button' : undefined}
            tabIndex={issue.objectId ? 0 : undefined}
            onKeyDown={(e) => {
              if (issue.objectId && (e.key === 'Enter' || e.key === ' ')) {
                onSelectObject(issue.objectId);
              }
            }}
          >
            <span className="vp-issue-icon">
              {issue.type === 'error' ? '\u{1F534}' : '\u{1F7E1}'}
            </span>
            <div className="vp-issue-content">
              <span className="vp-issue-message">{issue.message}</span>
              {issue.field && (
                <span className="vp-issue-field">Field: {issue.field}</span>
              )}
              {issue.objectId && (
                <span className="vp-issue-id">Object: {issue.objectId.slice(0, 8)}...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
