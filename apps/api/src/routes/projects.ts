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
  createObject,
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

// Import from wmquote — creates project + empty floorplans with quote requirements
// Workflow: 1) Create project  2) User uploads floor plans  3) User places rooms/desks on the map
router.post('/import-quote', (req, res) => {
  try {
    const { quote_slug, company_name, contact_name, num_rooms, num_desks, num_floors, num_lockers, num_carspaces, num_buildings, include_visitor_mgmt } = req.body;

    if (!company_name) {
      res.status(400).json({ error: 'company_name is required' });
      return;
    }

    const floors = Math.max(1, parseInt(num_floors) || 1);
    const rooms = parseInt(num_rooms) || 0;
    const desks = parseInt(num_desks) || 0;
    const lockers = parseInt(num_lockers) || 0;
    const carspaces = parseInt(num_carspaces) || 0;
    const buildings = parseInt(num_buildings) || 1;
    const visitorMgmt = include_visitor_mgmt ? 1 : 0;

    // Create project
    const projectId = crypto.randomUUID();
    createProject(projectId, `${company_name} — WorkMate Map`, company_name);

    // Store quote requirements in project metadata so the editor can show what needs to be placed
    updateProject(projectId, {
      metadata: JSON.stringify({
        source: 'wmquote',
        quote_slug: quote_slug || null,
        contact_name: contact_name || null,
        requirements: {
          rooms,
          desks,
          floors,
          lockers,
          carspaces,
          buildings,
          visitor_mgmt: visitorMgmt,
        },
      }),
    });

    // Create empty floorplans (one per floor) — user uploads floor plan images first
    for (let i = 1; i <= floors; i++) {
      const fpId = crypto.randomUUID();
      createFloorplan(fpId, projectId, `Level ${i}`, i);
    }

    const project = getProject(projectId);
    const floorplans = listFloorplans(projectId);

    res.status(201).json({
      success: true,
      project: { ...project, floorplans },
      requirements: { rooms, desks, floors, lockers, carspaces, buildings, visitor_mgmt: visitorMgmt },
    });
  } catch (err) {
    console.error('Import quote error:', err);
    res.status(500).json({ error: 'Failed to import quote' });
  }
});

export default router;
