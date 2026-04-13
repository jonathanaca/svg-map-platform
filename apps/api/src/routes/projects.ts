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

// Import from wmquote — creates project + floorplans + placeholder objects from quote data
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

    // Store quote reference in project metadata
    updateProject(projectId, {
      metadata: JSON.stringify({
        source: 'wmquote',
        quote_slug: quote_slug || null,
        contact_name: contact_name || null,
        num_rooms: rooms,
        num_desks: desks,
        num_floors: floors,
        num_lockers: lockers,
        num_carspaces: carspaces,
        num_buildings: buildings,
        include_visitor_mgmt: visitorMgmt,
      }),
    });

    // Create floorplans (one per floor)
    const floorplanIds: string[] = [];
    for (let i = 1; i <= floors; i++) {
      const fpId = crypto.randomUUID();
      createFloorplan(fpId, projectId, `Level ${i}`, i);
      floorplanIds.push(fpId);
    }

    // Distribute rooms/desks/lockers across floors
    const roomsPerFloor = Math.ceil(rooms / floors);
    const desksPerFloor = Math.ceil(desks / floors);
    const lockersPerFloor = Math.ceil(lockers / floors);

    let roomCount = 0, deskCount = 0, lockerCount = 0;
    for (let f = 0; f < floors; f++) {
      const fpId = floorplanIds[f];
      const floorNum = f + 1;

      // Place rooms
      const floorRooms = Math.min(roomsPerFloor, rooms - roomCount);
      for (let r = 0; r < floorRooms; r++) {
        roomCount++;
        const col = r % 4;
        const row = Math.floor(r / 4);
        createObject(crypto.randomUUID(), fpId, 'room', JSON.stringify({
          type: 'rect', x: 200 + col * 180, y: 150 + row * 130, width: 140, height: 90, rotation: 0,
        }), {
          svg_id: `ROOM-${floorNum}.${String(roomCount).padStart(2, '0')}`,
          label: `Room ${floorNum}.${String(r + 1).padStart(2, '0')}`,
          layer: 'rooms',
          fill_color: '#7c3aed55',
          stroke_color: '#7c3aed',
          capacity: 6,
          z_index: roomCount,
        });
      }

      // Place desks
      const floorDesks = Math.min(desksPerFloor, desks - deskCount);
      for (let d = 0; d < floorDesks; d++) {
        deskCount++;
        const col = d % 8;
        const row = Math.floor(d / 8);
        createObject(crypto.randomUUID(), fpId, 'desk', JSON.stringify({
          type: 'rect', x: 200 + col * 80, y: 600 + row * 70, width: 50, height: 40, rotation: 0,
        }), {
          svg_id: `DESK-${floorNum}.${String(deskCount).padStart(3, '0')}`,
          label: `Desk ${deskCount}`,
          layer: 'desks',
          fill_color: '#2563eb55',
          stroke_color: '#2563eb',
          capacity: 1,
          z_index: deskCount,
        });
      }

      // Place lockers
      const floorLockers = Math.min(lockersPerFloor, lockers - lockerCount);
      if (floorLockers > 0) {
        lockerCount += floorLockers;
        createObject(crypto.randomUUID(), fpId, 'amenity', JSON.stringify({
          type: 'rect', x: 100, y: 400, width: 60, height: floorLockers * 3 + 40, rotation: 0,
        }), {
          svg_id: `LOCKERS-L${floorNum}`,
          label: `Lockers (${floorLockers})`,
          layer: 'amenities',
          fill_color: '#dc262655',
          stroke_color: '#dc2626',
          capacity: floorLockers,
          z_index: 0,
        });
      }
    }

    // Create car spaces on ground floor
    if (carspaces > 0 && floorplanIds.length > 0) {
      for (let c = 0; c < carspaces; c++) {
        const col = c % 10;
        const row = Math.floor(c / 10);
        createObject(crypto.randomUUID(), floorplanIds[0], 'zone', JSON.stringify({
          type: 'rect', x: 200 + col * 70, y: 900 + row * 55, width: 55, height: 40, rotation: 0,
        }), {
          svg_id: `CARSPACE-${String(c + 1).padStart(3, '0')}`,
          label: `Car ${c + 1}`,
          layer: 'zones',
          fill_color: '#05966955',
          stroke_color: '#059669',
          capacity: 1,
          z_index: c,
        });
      }
    }

    const project = getProject(projectId);
    const floorplans = listFloorplans(projectId);

    res.status(201).json({
      success: true,
      project: { ...project, floorplans },
      summary: {
        floors,
        rooms_created: roomCount,
        desks_created: deskCount,
        lockers_created: lockerCount,
        carspaces_created: carspaces,
      },
    });
  } catch (err) {
    console.error('Import quote error:', err);
    res.status(500).json({ error: 'Failed to import quote' });
  }
});

export default router;
