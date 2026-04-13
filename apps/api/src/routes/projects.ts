import { Router } from 'express';
import crypto from 'crypto';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  createFloorplan,
  listFloorplans,
} from '../db/schema.js';

const router = Router();

// List all projects (with floorplans so the UI can show floor counts)
router.get('/', (_req, res) => {
  try {
    const projects = listProjects();
    const withFloorplans = projects.map((p: Record<string, unknown>) => ({
      ...p,
      floorplans: listFloorplans(p.id as string),
    }));
    res.json(withFloorplans);
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const { name, building_name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const id = crypto.randomUUID();
    createProject(id, name, building_name);
    const project = getProject(id);
    res.status(201).json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get project with floorplans
router.get('/:id', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const floorplans = listFloorplans(req.params.id);
    res.json({ ...project, floorplans });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Update project
router.put('/:id', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    updateProject(req.params.id, req.body);
    const updated = getProject(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Add floorplan to project
router.post('/:id/floorplans', (req, res) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    const { floor_name, floor_index } = req.body;
    if (!floor_name) {
      res.status(400).json({ error: 'floor_name is required' });
      return;
    }
    const id = crypto.randomUUID();
    createFloorplan(id, req.params.id, floor_name, floor_index);
    const floorplans = listFloorplans(req.params.id);
    res.status(201).json(floorplans);
  } catch (err) {
    console.error('Add floorplan error:', err);
    res.status(500).json({ error: 'Failed to add floorplan' });
  }
});

export default router;
