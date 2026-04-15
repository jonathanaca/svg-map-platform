import { useState, useEffect } from 'react';
import type { Project, Floorplan, MapObject } from '@svg-map/types';
import { getProject, getFloorplan, listObjects } from '../lib/api.js';

interface KioskData {
  project: Project | null;
  floorplan: Floorplan | null;
  objects: MapObject[];
  isLoading: boolean;
  error: string | null;
}

export function useKioskData(projectId: string, floorplanId: string | null): KioskData {
  const [project, setProject] = useState<Project | null>(null);
  const [floorplan, setFloorplan] = useState<Floorplan | null>(null);
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then(setProject)
      .catch((e) => setError(e.message));
  }, [projectId]);

  useEffect(() => {
    if (!floorplanId) return;
    setIsLoading(true);
    Promise.all([
      getFloorplan(floorplanId),
      listObjects(floorplanId),
    ])
      .then(([fp, objs]) => {
        setFloorplan(fp);
        setObjects(objs);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [floorplanId]);

  return { project, floorplan, objects, isLoading, error };
}
