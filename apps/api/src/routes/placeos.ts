import { Router } from 'express';

const router = Router();

// PlaceOS connection settings (stored in memory for now, could be DB-backed)
let placeos_config: { domain: string; api_key: string } | null = null;

function getConfig() {
  return placeos_config ?? {
    domain: process.env.PLACEOS_DOMAIN ?? '',
    api_key: process.env.PLACEOS_API_KEY ?? '',
  };
}

async function placeosFetch(path: string, options: RequestInit = {}) {
  const config = getConfig();
  if (!config.domain || !config.api_key) {
    throw new Error('PlaceOS not configured');
  }
  const url = `${config.domain.replace(/\/$/, '')}/api/engine/v2${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'X-API-Key': config.api_key,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`PlaceOS ${resp.status}: ${text || resp.statusText}`);
  }
  return resp;
}

// ── Config ──

router.get('/config', (_req, res) => {
  const config = getConfig();
  res.json({
    configured: !!(config.domain && config.api_key),
    domain: config.domain,
    // Don't expose the full API key
    has_key: !!config.api_key,
  });
});

router.post('/config', (req, res) => {
  const { domain, api_key } = req.body;
  placeos_config = { domain, api_key };
  res.json({ ok: true });
});

// ── Test connection ──

router.get('/test', async (_req, res) => {
  try {
    const resp = await placeosFetch('/users/current');
    const user = await resp.json();
    res.json({ ok: true, user: { name: user.name, email: user.email, sys_admin: user.sys_admin } });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Connection failed' });
  }
});

// ── Zones ──

router.get('/zones', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.tags) params.set('tags', req.query.tags as string);
    if (req.query.parent_id) params.set('parent_id', req.query.parent_id as string);
    if (req.query.limit) params.set('limit', req.query.limit as string);
    else params.set('limit', '100');
    const resp = await placeosFetch(`/zones?${params}`);
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch zones' });
  }
});

router.get('/zones/:id', async (req, res) => {
  try {
    const resp = await placeosFetch(`/zones/${req.params.id}`);
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch zone' });
  }
});

router.put('/zones/:id', async (req, res) => {
  try {
    const resp = await placeosFetch(`/zones/${req.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update zone' });
  }
});

// ── Systems ──

router.get('/systems', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.zone_id) params.set('zone_id', req.query.zone_id as string);
    if (req.query.limit) params.set('limit', req.query.limit as string);
    else params.set('limit', '100');
    if (req.query.bookable) params.set('bookable', req.query.bookable as string);
    const resp = await placeosFetch(`/systems?${params}`);
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch systems' });
  }
});

router.put('/systems/:id', async (req, res) => {
  try {
    const resp = await placeosFetch(`/systems/${req.params.id}`, {
      method: 'PUT',
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.json(data);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update system' });
  }
});

// ── Upload SVG to PlaceOS ──

router.post('/upload-svg', async (req, res) => {
  try {
    const { svg_content, filename } = req.body;
    if (!svg_content || !filename) {
      return res.status(400).json({ error: 'svg_content and filename required' });
    }

    const config = getConfig();
    if (!config.domain || !config.api_key) {
      return res.status(400).json({ error: 'PlaceOS not configured' });
    }

    // Step 1: Create upload record
    const blob = new Blob([svg_content], { type: 'image/svg+xml' });
    const createResp = await placeosFetch('/uploads', {
      method: 'POST',
      body: JSON.stringify({
        file_name: filename,
        file_size: blob.size,
        file_mime: 'image/svg+xml',
        public: true,
      }),
    });
    const upload = await createResp.json() as {
      id: string;
      upload_url: string;
      upload_headers: Record<string, string>;
      type: string;
      resumable_id?: string;
    };

    // Step 2: Upload the file to the signed URL
    const uploadResp = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/svg+xml',
        ...upload.upload_headers,
      },
      body: svg_content,
    });

    if (!uploadResp.ok) {
      throw new Error(`Upload to storage failed: ${uploadResp.status}`);
    }

    // Step 3: Finalize
    const finalizeResp = await placeosFetch(`/uploads/${upload.id}`, {
      method: 'PUT',
      body: JSON.stringify({ upload_complete: true }),
    });
    const finalized = await finalizeResp.json() as { id: string; file_name: string; public_url?: string };

    // The URL to reference this file
    const file_url = finalized.public_url ?? `/api/engine/v2/uploads/${upload.id}/url`;

    res.json({ ok: true, upload_id: upload.id, file_url });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

export default router;
