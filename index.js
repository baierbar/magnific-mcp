#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const API_KEY = process.env.MAGNIFIC_API_KEY;
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const BASE_URL = 'https://api.freepik.com/v1/ai';
const PORT = process.env.PORT || 3000;

const headers = {
  'Content-Type': 'application/json',
  'x-freepik-api-key': API_KEY,
};

// ─── MODELS ──────────────────────────────────────────────────────────────────
const IMAGE_MODELS = {
  'mystic':              { endpoint: `${BASE_URL}/mystic`,                                 supportsRefs: false },
  'seedream-v5-lite':    { endpoint: `${BASE_URL}/text-to-image/seedream-v5-lite`,         editEndpoint: `${BASE_URL}/text-to-image/seedream-v5-lite-edit`, supportsRefs: true },
  'seedream-v4-5':       { endpoint: `${BASE_URL}/text-to-image/seedream-v4-5`,            editEndpoint: `${BASE_URL}/text-to-image/seedream-v4-5-edit`,    supportsRefs: true },
  'seedream-v4':         { endpoint: `${BASE_URL}/text-to-image/seedream-v4`,              editEndpoint: `${BASE_URL}/text-to-image/seedream-v4-edit`,      supportsRefs: true },
  'seedream':            { endpoint: `${BASE_URL}/text-to-image/seedream`,                 supportsRefs: false },
  'flux-2-pro':          { endpoint: `${BASE_URL}/text-to-image/flux-2-pro`,               supportsRefs: false },
  'flux-2-turbo':        { endpoint: `${BASE_URL}/text-to-image/flux-2-turbo`,             supportsRefs: false },
  'flux-2-klein':        { endpoint: `${BASE_URL}/text-to-image/flux-2-klein`,             supportsRefs: false },
  'flux-pro-v1-1':       { endpoint: `${BASE_URL}/text-to-image/flux-pro-v1-1`,            supportsRefs: false },
  'flux-dev':            { endpoint: `${BASE_URL}/text-to-image/flux-dev`,                 supportsRefs: false },
  'flux-kontext-pro':    { endpoint: `${BASE_URL}/text-to-image/flux-kontext-pro`,         supportsRefs: false },
  'hyperflux':           { endpoint: `${BASE_URL}/text-to-image/hyperflux`,                supportsRefs: false },
  'z-image':             { endpoint: `${BASE_URL}/text-to-image/z-image`,                  supportsRefs: false },
};

const VIDEO_MODELS = {
  'kling-v2-6-pro':              `${BASE_URL}/image-to-video/kling-v2-6-pro`,
  'kling-v2-6':                  `${BASE_URL}/image-to-video/kling-v2-6`,
  'kling-v2-5-pro':              `${BASE_URL}/image-to-video/kling-v2-5-pro`,
  'kling-v2-1-master':           `${BASE_URL}/image-to-video/kling-v2-1-master`,
  'kling-v2-1-pro':              `${BASE_URL}/image-to-video/kling-v2-1-pro`,
  'kling-v2-1-std':              `${BASE_URL}/image-to-video/kling-v2-1-std`,
  'kling-v2':                    `${BASE_URL}/image-to-video/kling-v2`,
  'kling-pro':                   `${BASE_URL}/image-to-video/kling-pro`,
  'kling-std':                   `${BASE_URL}/image-to-video/kling-std`,
  'kling-elements-pro':          `${BASE_URL}/image-to-video/kling-elements-pro`,
  'kling-elements-std':          `${BASE_URL}/image-to-video/kling-elements-std`,
  'kling-o1-pro':                `${BASE_URL}/image-to-video/kling-o1-pro`,
  'kling-o1-std':                `${BASE_URL}/image-to-video/kling-o1-std`,
  'seedance-pro-1080p':          `${BASE_URL}/image-to-video/seedance-pro-1080p`,
  'seedance-pro-720p':           `${BASE_URL}/image-to-video/seedance-pro-720p`,
  'seedance-pro-480p':           `${BASE_URL}/image-to-video/seedance-pro-480p`,
  'seedance-lite-1080p':         `${BASE_URL}/image-to-video/seedance-lite-1080p`,
  'seedance-lite-720p':          `${BASE_URL}/image-to-video/seedance-lite-720p`,
  'seedance-lite-480p':          `${BASE_URL}/image-to-video/seedance-lite-480p`,
  'minimax-hailuo-2-3-1080p':      `${BASE_URL}/image-to-video/minimax-hailuo-2-3-1080p`,
  'minimax-hailuo-2-3-1080p-fast': `${BASE_URL}/image-to-video/minimax-hailuo-2-3-1080p-fast`,
  'minimax-hailuo-2-3-768p':       `${BASE_URL}/image-to-video/minimax-hailuo-2-3-768p`,
  'minimax-hailuo-2-3-768p-fast':  `${BASE_URL}/image-to-video/minimax-hailuo-2-3-768p-fast`,
  'minimax-hailuo-02-1080p':       `${BASE_URL}/image-to-video/minimax-hailuo-02-1080p`,
  'minimax-hailuo-02-768p':        `${BASE_URL}/image-to-video/minimax-hailuo-02-768p`,
  'minimax-live':                  `${BASE_URL}/image-to-video/minimax-live`,
  'wan-2-7':                     `${BASE_URL}/image-to-video/wan-2-7`,
  'wan-v2-6-1080p':              `${BASE_URL}/image-to-video/wan-v2-6-1080p`,
  'wan-v2-6-720p':               `${BASE_URL}/image-to-video/wan-v2-6-720p`,
  'wan-2-5-i2v-1080p':           `${BASE_URL}/image-to-video/wan-2-5-i2v-1080p`,
  'wan-2-5-i2v-720p':            `${BASE_URL}/image-to-video/wan-2-5-i2v-720p`,
  'wan-2-5-i2v-480p':            `${BASE_URL}/image-to-video/wan-2-5-i2v-480p`,
  'wan-v2-2-720p':               `${BASE_URL}/image-to-video/wan-v2-2-720p`,
  'wan-v2-2-580p':               `${BASE_URL}/image-to-video/wan-v2-2-580p`,
  'wan-v2-2-480p':               `${BASE_URL}/image-to-video/wan-v2-2-480p`,
  'ltx-2-pro':                   `${BASE_URL}/image-to-video/ltx-2-pro`,
  'ltx-2-fast':                  `${BASE_URL}/image-to-video/ltx-2-fast`,
  'runway-gen4-turbo':            `${BASE_URL}/image-to-video/runway-gen4-turbo`,
  'pixverse-v5':                  `${BASE_URL}/image-to-video/pixverse-v5`,
  'pixverse-v5-transition':       `${BASE_URL}/image-to-video/pixverse-v5-transition`,
};

const TEXT_VIDEO_MODELS = {
  'wan-2-7-t2v':            `${BASE_URL}/text-to-video/wan-2-7`,
  'wan-2-5-t2v-1080p':      `${BASE_URL}/text-to-video/wan-2-5-t2v-1080p`,
  'wan-2-5-t2v-720p':       `${BASE_URL}/text-to-video/wan-2-5-t2v-720p`,
  'wan-2-5-t2v-480p':       `${BASE_URL}/text-to-video/wan-2-5-t2v-480p`,
  'wan-v2-6-t2v-1080p':     `${BASE_URL}/text-to-video/wan-v2-6-1080p`,
  'wan-v2-6-t2v-720p':      `${BASE_URL}/text-to-video/wan-v2-6-720p`,
  'ltx-2-pro-t2v':          `${BASE_URL}/text-to-video/ltx-2-pro`,
  'ltx-2-fast-t2v':          `${BASE_URL}/text-to-video/ltx-2-fast`,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
};

async function loadImage(ref) {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref)) return ref;
  let path = ref.trim();
  if (path.startsWith('~/')) path = path.replace(/^~/, process.env.HOME || '');
  path = resolve(path);
  const info = await stat(path);
  if (info.size > MAX_FILE_BYTES) throw new Error(`Image too large (${(info.size / 1e6).toFixed(1)} MB). Limit is 10 MB.`);
  const ext = extname(path).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) throw new Error(`Unsupported image format: ${ext}. Use JPG, PNG, or WebP.`);
  const buf = await readFile(path);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function loadImages(refs) {
  if (!refs) return [];
  const list = Array.isArray(refs) ? refs : [refs];
  return Promise.all(list.map(loadImage));
}

async function pollTask(statusUrl, { maxWaitMs = 240000, initial = 3000 } = {}) {
  const start = Date.now();
  let delay = initial;
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 8000);
    const res = await fetch(statusUrl, { headers });
    if (!res.ok) throw new Error(`Status check failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const status = (data?.data?.status || data?.status || '').toUpperCase();
    if (['COMPLETED', 'SUCCEEDED', 'SUCCESS'].includes(status)) return data;
    if (['FAILED', 'ERROR', 'CANCELLED'].includes(status)) throw new Error(`Generation failed: ${JSON.stringify(data)}`);
  }
  throw new Error('Timeout - use check_task with the returned task_id to retrieve the result later.');
}

function extractUrls(data) {
  const d = data?.data || data;
  if (Array.isArray(d?.generated)) return d.generated.map((g) => g.url || g).filter(Boolean);
  if (d?.url) return [d.url];
  if (d?.video_url) return [d.video_url];
  if (d?.output_url) return [d.output_url];
  return [];
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ─── MCP SERVER FACTORY (one per request - stateless) ────────────────────────

function buildServer() {
  const server = new Server(
    { name: 'magnific-mcp', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'generate_image',
        description:
          'Generate (or edit) an image with Magnific/Freepik AI. ' +
          'Supports 13 models: Seedream v5 Lite, Seedream 4.5, Seedream v4, Flux 2 Pro/Turbo/Klein, ' +
          'Flux Pro v1.1, Flux Dev, Flux Kontext Pro, HyperFlux, Z-Image, Mystic. ' +
          'If reference_images is provided with an edit-capable model (seedream-v4/v4-5/v5-lite), ' +
          'it uses the edit endpoint to preserve subject/style.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Text description of the desired image.' },
            model: {
              type: 'string',
              enum: Object.keys(IMAGE_MODELS),
              default: 'seedream-v4-5',
            },
            reference_images: {
              type: 'array',
              items: { type: 'string' },
              description: 'Up to 5 reference images as public URLs or absolute local file paths.',
            },
            aspect_ratio: {
              type: 'string',
              enum: ['square_1_1', 'portrait_3_4', 'portrait_9_16', 'landscape_4_3', 'landscape_16_9', 'classic_3_2', 'widescreen_16_9'],
              default: 'square_1_1',
            },
            resolution: { type: 'string', enum: ['1k', '2k', '4k'], default: '2k', description: 'Mystic only.' },
            negative_prompt: { type: 'string' },
            seed: { type: 'integer' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'generate_video',
        description:
          'Animate an image into a video (image-to-video). ' +
          'Supports 35+ models: Kling v2.6/v2.5/v2.1/Elements/O1, Seedance Pro/Lite, ' +
          'MiniMax Hailuo 2.3, WAN 2.7/2.6/2.5, LTX 2, Runway Gen4, PixVerse v5.',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Source image: public URL or absolute local file path.' },
            prompt: { type: 'string' },
            negative_prompt: { type: 'string' },
            model: { type: 'string', enum: Object.keys(VIDEO_MODELS), default: 'kling-v2-5-pro' },
            duration: { type: 'string', enum: ['5', '10'], default: '5' },
            cfg_scale: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
          },
          required: ['image'],
        },
      },
      {
        name: 'generate_video_from_text',
        description: 'Generate a video from text only (no image). Models: WAN 2.7/2.6/2.5, LTX 2 Pro/Fast.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            negative_prompt: { type: 'string' },
            model: { type: 'string', enum: Object.keys(TEXT_VIDEO_MODELS), default: 'wan-2-7-t2v' },
            duration: { type: 'string', enum: ['5', '10'], default: '5' },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'check_task',
        description: 'Check the status of an async task and retrieve its result URL(s).',
        inputSchema: {
          type: 'object',
          properties: {
            status_url: { type: 'string', description: 'Full status URL returned by a previous generate_* call.' },
          },
          required: ['status_url'],
        },
      },
      {
        name: 'list_models',
        description: 'List all available image / video / text-to-video models.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      if (name === 'list_models') {
        return {
          content: [{
            type: 'text',
            text:
              `**Image models (${Object.keys(IMAGE_MODELS).length}):**\n` +
              Object.entries(IMAGE_MODELS).map(([k, v]) => `  - ${k}${v.supportsRefs ? '  [supports reference_images]' : ''}`).join('\n') +
              `\n\n**Image-to-video models (${Object.keys(VIDEO_MODELS).length}):**\n` +
              Object.keys(VIDEO_MODELS).map((m) => `  - ${m}`).join('\n') +
              `\n\n**Text-to-video models (${Object.keys(TEXT_VIDEO_MODELS).length}):**\n` +
              Object.keys(TEXT_VIDEO_MODELS).map((m) => `  - ${m}`).join('\n'),
          }],
        };
      }

      if (name === 'generate_image') {
        const { prompt, model = 'seedream-v4-5', reference_images, aspect_ratio = 'square_1_1', resolution = '2k', negative_prompt, seed } = args;
        const spec = IMAGE_MODELS[model];
        if (!spec) return { content: [{ type: 'text', text: `Unknown model: ${model}` }] };
        const refs = await loadImages(reference_images);
        const useEdit = refs.length > 0 && spec.editEndpoint;
        if (refs.length > 0 && !spec.editEndpoint) {
          return { content: [{ type: 'text', text: `Model "${model}" does not support reference_images. Use seedream-v4, seedream-v4-5, or seedream-v5-lite.` }] };
        }
        const endpoint = useEdit ? spec.editEndpoint : spec.endpoint;
        const body = { prompt, aspect_ratio };
        if (useEdit) body.reference_images = refs;
        if (model === 'mystic') body.resolution = resolution;
        if (negative_prompt) body.negative_prompt = negative_prompt;
        if (seed != null) body.seed = seed;
        const data = await postJson(endpoint, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const syncUrls = extractUrls(data);
        if (syncUrls.length && !taskId) {
          return { content: [{ type: 'text', text: `Image ready (${model}):\n` + syncUrls.join('\n') }] };
        }
        const statusUrl = `${endpoint}/${taskId}`;
        try {
          const result = await pollTask(statusUrl);
          const urls = extractUrls(result);
          return {
            content: [{ type: 'text', text: `Image ready (${model})${useEdit ? ' [edit mode]' : ''}:\n` + (urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)) }],
          };
        } catch (e) {
          return { content: [{ type: 'text', text: `Generation started but polling timed out.\ntask_id: ${taskId}\nstatus_url: ${statusUrl}\n\n${e.message}` }] };
        }
      }

      if (name === 'generate_video') {
        const { image, prompt, negative_prompt, model = 'kling-v2-5-pro', duration = '5', cfg_scale = 0.5 } = args;
        const endpoint = VIDEO_MODELS[model];
        if (!endpoint) return { content: [{ type: 'text', text: `Unknown video model: ${model}` }] };
        const body = { image: await loadImage(image), duration, cfg_scale };
        if (prompt) body.prompt = prompt;
        if (negative_prompt) body.negative_prompt = negative_prompt;
        const data = await postJson(endpoint, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${endpoint}/${taskId}`;
        return {
          content: [{ type: 'text', text: `Video generation started (${model}, ${duration}s)\ntask_id: ${taskId}\nstatus_url: ${statusUrl}\n\nVideos take 1-4 minutes. Use check_task with the status_url to get the result.` }],
        };
      }

      if (name === 'generate_video_from_text') {
        const { prompt, negative_prompt, model = 'wan-2-7-t2v', duration = '5' } = args;
        const endpoint = TEXT_VIDEO_MODELS[model];
        if (!endpoint) return { content: [{ type: 'text', text: `Unknown model: ${model}` }] };
        const body = { prompt, duration };
        if (negative_prompt) body.negative_prompt = negative_prompt;
        const data = await postJson(endpoint, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${endpoint}/${taskId}`;
        return {
          content: [{ type: 'text', text: `Text-to-video started (${model}, ${duration}s)\ntask_id: ${taskId}\nstatus_url: ${statusUrl}\n\nUse check_task with the status_url to retrieve the video.` }],
        };
      }

      if (name === 'check_task') {
        const { status_url } = args;
        const res = await fetch(status_url, { headers });
        const data = await res.json();
        const status = data?.data?.status || data?.status || 'unknown';
        const urls = extractUrls(data);
        return {
          content: [{ type: 'text', text: `Status: ${status}\n` + (urls.length ? urls.join('\n') : JSON.stringify(data?.data || data, null, 2)) }],
        };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
    }
  });

  return server;
}

// ─── EXPRESS APP ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  if (!MCP_AUTH_TOKEN) return next();
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${MCP_AUTH_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/', (_req, res) => res.json({ status: 'ok', name: 'magnific-mcp', version: '2.0.0' }));

app.post('/mcp', requireAuth, async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => console.log(`magnific-mcp running on port ${PORT} - POST /mcp`));
