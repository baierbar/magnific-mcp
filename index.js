#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const API_KEY = process.env.MAGNIFIC_API_KEY;
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const BASE = 'https://api.freepik.com/v1/ai';
const PORT = process.env.PORT || 3000;

const headers = {
  'Content-Type': 'application/json',
  'x-freepik-api-key': API_KEY,
  'x-magnific-api-key': API_KEY,
};

// ─── IMAGE GENERATION MODELS ──────────────────────────────────────────────────
const IMAGE_MODELS = {
  // Nano Banana (Google Gemini)
  'nano-banana-pro-flash':  { endpoint: `${BASE}/text-to-image/nano-banana-pro-flash`, supportsRefs: true },
  // Mystic
  'mystic':                 { endpoint: `${BASE}/mystic`, supportsRefs: false },
  // Seedream
  'seedream-v4-5':          { endpoint: `${BASE}/text-to-image/seedream-v4-5`, editEndpoint: `${BASE}/text-to-image/seedream-v4-5-edit`, supportsRefs: true },
  'seedream-v4':            { endpoint: `${BASE}/text-to-image/seedream-v4`,   editEndpoint: `${BASE}/text-to-image/seedream-v4-edit`,   supportsRefs: true },
  'seedream-v5-lite':       { endpoint: `${BASE}/text-to-image/seedream-v5-lite`, editEndpoint: `${BASE}/text-to-image/seedream-v5-lite-edit`, supportsRefs: true },
  'seedream':               { endpoint: `${BASE}/text-to-image/seedream`, supportsRefs: false },
  // Flux
  'flux-kontext-pro':       { endpoint: `${BASE}/text-to-image/flux-kontext-pro`, supportsRefs: false },
  'flux-2-pro':             { endpoint: `${BASE}/text-to-image/flux-2-pro`, supportsRefs: false },
  'flux-2-turbo':           { endpoint: `${BASE}/text-to-image/flux-2-turbo`, supportsRefs: false },
  'flux-2-klein':           { endpoint: `${BASE}/text-to-image/flux-2-klein`, supportsRefs: false },
  'flux-pro-v1-1':          { endpoint: `${BASE}/text-to-image/flux-pro-v1-1`, supportsRefs: false },
  'flux-dev':               { endpoint: `${BASE}/text-to-image/flux-dev`, supportsRefs: false },
  'hyperflux':              { endpoint: `${BASE}/text-to-image/hyperflux`, supportsRefs: false },
  // Other
  'runway-t2i':             { endpoint: `${BASE}/text-to-image/runway`, supportsRefs: false },
  'z-image':                { endpoint: `${BASE}/text-to-image/z-image`, supportsRefs: false },
};

// ─── IMAGE-TO-VIDEO MODELS ────────────────────────────────────────────────────
const VIDEO_MODELS = {
  // Kling
  'kling-v2-6-pro':              `${BASE}/image-to-video/kling-v2-6-pro`,
  'kling-v2-6':                  `${BASE}/image-to-video/kling-v2-6`,
  'kling-v2-6-motion':           `${BASE}/image-to-video/kling-motion`,
  'kling-v2-5-pro':              `${BASE}/image-to-video/kling-v2-5-pro`,
  'kling-v2-1-master':           `${BASE}/image-to-video/kling-v2-1-master`,
  'kling-v2-1-pro':              `${BASE}/image-to-video/kling-v2-1-pro`,
  'kling-v2-1-std':              `${BASE}/image-to-video/kling-v2-1-std`,
  'kling-v2':                    `${BASE}/image-to-video/kling-v2`,
  'kling-pro':                   `${BASE}/image-to-video/kling-pro`,
  'kling-std':                   `${BASE}/image-to-video/kling-std`,
  'kling-elements-pro':          `${BASE}/image-to-video/kling-elements-pro`,
  'kling-elements-std':          `${BASE}/image-to-video/kling-elements-std`,
  'kling-o1-pro':                `${BASE}/image-to-video/kling-o1-pro`,
  'kling-o1-std':                `${BASE}/image-to-video/kling-o1-std`,
  // Seedance
  'seedance-pro-1080p':          `${BASE}/image-to-video/seedance-pro-1080p`,
  'seedance-pro-720p':           `${BASE}/image-to-video/seedance-pro-720p`,
  'seedance-pro-480p':           `${BASE}/image-to-video/seedance-pro-480p`,
  'seedance-lite-1080p':         `${BASE}/image-to-video/seedance-lite-1080p`,
  'seedance-lite-720p':          `${BASE}/image-to-video/seedance-lite-720p`,
  'seedance-lite-480p':          `${BASE}/image-to-video/seedance-lite-480p`,
  // MiniMax Hailuo
  'minimax-hailuo-2-3-1080p':      `${BASE}/image-to-video/minimax-hailuo-2-3-1080p`,
  'minimax-hailuo-2-3-1080p-fast': `${BASE}/image-to-video/minimax-hailuo-2-3-1080p-fast`,
  'minimax-hailuo-2-3-768p':       `${BASE}/image-to-video/minimax-hailuo-2-3-768p`,
  'minimax-hailuo-2-3-768p-fast':  `${BASE}/image-to-video/minimax-hailuo-2-3-768p-fast`,
  'minimax-hailuo-02-1080p':       `${BASE}/image-to-video/minimax-hailuo-02-1080p`,
  'minimax-hailuo-02-768p':        `${BASE}/image-to-video/minimax-hailuo-02-768p`,
  'minimax-live':                  `${BASE}/image-to-video/minimax-live`,
  // WAN
  'wan-2-7':                     `${BASE}/image-to-video/wan-2-7`,
  'wan-v2-6-1080p':              `${BASE}/image-to-video/wan-v2-6-1080p`,
  'wan-v2-6-720p':               `${BASE}/image-to-video/wan-v2-6-720p`,
  'wan-2-5-i2v-1080p':           `${BASE}/image-to-video/wan-2-5-i2v-1080p`,
  'wan-2-5-i2v-720p':            `${BASE}/image-to-video/wan-2-5-i2v-720p`,
  'wan-2-5-i2v-480p':            `${BASE}/image-to-video/wan-2-5-i2v-480p`,
  'wan-v2-2-720p':               `${BASE}/image-to-video/wan-v2-2-720p`,
  'wan-v2-2-580p':               `${BASE}/image-to-video/wan-v2-2-580p`,
  'wan-v2-2-480p':               `${BASE}/image-to-video/wan-v2-2-480p`,
  // LTX
  'ltx-2-pro':                   `${BASE}/image-to-video/ltx-2-pro`,
  'ltx-2-fast':                  `${BASE}/image-to-video/ltx-2-fast`,
  // Runway
  'runway-gen4-turbo':            `${BASE}/image-to-video/runway-gen4-turbo`,
  // PixVerse
  'pixverse-v6':                  `${BASE}/image-to-video/pixverse-v6`,
  'pixverse-v5':                  `${BASE}/image-to-video/pixverse-v5`,
  'pixverse-v5-transition':       `${BASE}/image-to-video/pixverse-v5-transition`,
};

// ─── TEXT-TO-VIDEO MODELS ─────────────────────────────────────────────────────
const TEXT_VIDEO_MODELS = {
  'wan-2-7-t2v':        `${BASE}/text-to-video/wan-2-7`,
  'wan-2-5-t2v-1080p':  `${BASE}/text-to-video/wan-2-5-t2v-1080p`,
  'wan-2-5-t2v-720p':   `${BASE}/text-to-video/wan-2-5-t2v-720p`,
  'wan-2-5-t2v-480p':   `${BASE}/text-to-video/wan-2-5-t2v-480p`,
  'wan-v2-6-t2v-1080p': `${BASE}/text-to-video/wan-v2-6-1080p`,
  'wan-v2-6-t2v-720p':  `${BASE}/text-to-video/wan-v2-6-720p`,
  'ltx-2-pro-t2v':      `${BASE}/text-to-video/ltx-2-pro`,
  'ltx-2-fast-t2v':     `${BASE}/text-to-video/ltx-2-fast`,
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

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
  return Promise.all((Array.isArray(refs) ? refs : [refs]).map(loadImage));
}

async function pollTask(statusUrl, { maxWaitMs = 300000, initial = 3000 } = {}) {
  const start = Date.now();
  let delay = initial;
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 8000);
    const res = await fetch(statusUrl, { headers });
    if (!res.ok) throw new Error(`Status check failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const status = (data?.data?.status || data?.status || '').toUpperCase();
    if (['COMPLETED', 'SUCCEEDED', 'SUCCESS', 'DONE'].includes(status)) return data;
    if (['FAILED', 'ERROR', 'CANCELLED'].includes(status)) throw new Error(`Failed: ${JSON.stringify(data)}`);
  }
  throw new Error('Timeout - use check_task with the returned status_url to retrieve result later.');
}

function extractUrls(data) {
  const d = data?.data || data;
  if (Array.isArray(d?.generated)) return d.generated.map((g) => g.url || g).filter(Boolean);
  if (Array.isArray(d?.images)) return d.images.map((g) => g.url || g).filter(Boolean);
  if (d?.url) return [d.url];
  if (d?.video_url) return [d.video_url];
  if (d?.output_url) return [d.output_url];
  if (d?.audio_url) return [d.audio_url];
  return [];
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function runAsync(endpoint, body) {
  const data = await postJson(endpoint, body);
  const taskId = data?.data?.task_id || data?.task_id;
  const syncUrls = extractUrls(data);
  if (syncUrls.length && !taskId) return { done: true, urls: syncUrls };
  const statusUrl = `${endpoint}/${taskId}`;
  return { done: false, taskId, statusUrl };
}

// ─── SERVER FACTORY ───────────────────────────────────────────────────────────

function buildServer() {
  const server = new Server({ name: 'magnific-mcp', version: '3.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'generate_image',
        description:
          'Generate an image from text. Models include Nano Banana Pro Flash (Google Gemini - best quality/speed), ' +
          'Mystic (Magnific exclusive), Seedream v4/v4-5/v5-lite (support reference images), ' +
          'Flux family (Kontext Pro, 2 Pro, 2 Turbo, 2 Klein, Pro v1.1, Dev, HyperFlux), ' +
          'RunWay Gen4 Image, and Z-Image. Default: nano-banana-pro-flash.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            model: { type: 'string', enum: Object.keys(IMAGE_MODELS), default: 'nano-banana-pro-flash' },
            reference_images: {
              type: 'array', items: { type: 'string' },
              description: 'Up to 5 reference images (URLs or local file paths). Supported on nano-banana-pro-flash and seedream models.',
            },
            aspect_ratio: {
              type: 'string',
              enum: ['square_1_1', 'portrait_3_4', 'portrait_9_16', 'landscape_4_3', 'landscape_16_9', 'classic_3_2', 'widescreen_16_9'],
              default: 'square_1_1',
            },
            resolution: { type: 'string', enum: ['1k', '2k', '4k'], default: '2k' },
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
          '35+ models: Kling v2.6 Pro/Motion Control, Kling v2.5/v2.1/O1/Elements, ' +
          'Seedance Pro/Lite, MiniMax Hailuo 2.3, WAN 2.7/2.6/2.5, LTX 2, Runway Gen4, PixVerse V6/V5.',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Source image: public URL or local file path.' },
            prompt: { type: 'string' },
            negative_prompt: { type: 'string' },
            model: { type: 'string', enum: Object.keys(VIDEO_MODELS), default: 'kling-v2-6-pro' },
            duration: { type: 'string', enum: ['5', '10'], default: '5' },
            cfg_scale: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
          },
          required: ['image'],
        },
      },
      {
        name: 'generate_video_from_text',
        description: 'Generate a video from text only (no image needed). Models: WAN 2.7/2.6/2.5, LTX 2 Pro/Fast.',
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
        name: 'remove_background',
        description: 'Remove the background from an image. Fast synchronous result. Input: public image URL.',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the image (JPG or PNG).' },
          },
          required: ['image_url'],
        },
      },
      {
        name: 'upscale_image',
        description: 'Upscale an image to higher resolution with AI enhancement. Two modes: creative (adds detail) or precision (faithful to original).',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the image.' },
            mode: { type: 'string', enum: ['creative', 'precision'], default: 'creative', description: 'creative: adds detail. precision: faithful upscale.' },
            scale_factor: { type: 'number', enum: [2, 4], default: 2 },
          },
          required: ['image_url'],
        },
      },
      {
        name: 'expand_image',
        description: 'Expand an image outward in any direction (outpainting). Adds pixels to sides of the image using AI. Choose Flux Pro, Seedream, or Ideogram engine.',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the image.' },
            prompt: { type: 'string', description: 'Optional description of what to add in the expanded area.' },
            expand_top: { type: 'integer', default: 0, description: 'Pixels to add at top.' },
            expand_bottom: { type: 'integer', default: 0, description: 'Pixels to add at bottom.' },
            expand_left: { type: 'integer', default: 0, description: 'Pixels to add at left.' },
            expand_right: { type: 'integer', default: 0, description: 'Pixels to add at right.' },
            engine: { type: 'string', enum: ['flux-pro', 'seedream-v4-5', 'ideogram'], default: 'flux-pro' },
          },
          required: ['image_url'],
        },
      },
      {
        name: 'relight_image',
        description: 'Change the lighting of an image using AI. Describe the desired lighting in text, or provide a reference image or lightmap.',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the image to relight.' },
            prompt: { type: 'string', description: 'Describe the desired lighting (e.g. "golden hour sunlight from the right", "dramatic studio lighting").' },
            reference_image_url: { type: 'string', description: 'Optional: URL of a reference image to copy lighting from.' },
            lightmap_url: { type: 'string', description: 'Optional: URL of a lightmap image (black = no light, white = full light).' },
          },
          required: ['image_url', 'prompt'],
        },
      },
      {
        name: 'style_transfer',
        description: 'Apply the style of one image to another. Transfer artistic style, color palette, or visual texture from a style reference image.',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the content image (what to style).' },
            style_image_url: { type: 'string', description: 'Public HTTPS URL of the style reference image.' },
            prompt: { type: 'string', description: 'Optional text to guide the style transfer.' },
            strength: { type: 'number', minimum: 0, maximum: 1, default: 0.8, description: 'Style transfer strength (0=subtle, 1=full).' },
          },
          required: ['image_url', 'style_image_url'],
        },
      },
      {
        name: 'change_camera',
        description: 'Change the camera angle/perspective of an image. Rotate horizontally (0-360), tilt vertically (-30 to 90), and zoom.',
        inputSchema: {
          type: 'object',
          properties: {
            image_url: { type: 'string', description: 'Public HTTPS URL of the image.' },
            horizontal_rotation: { type: 'number', minimum: 0, maximum: 360, default: 45, description: '0=front, 90=right, 180=back, 270=left.' },
            vertical_tilt: { type: 'number', minimum: -30, maximum: 90, default: 0, description: 'Vertical camera tilt in degrees.' },
            zoom: { type: 'number', minimum: 0, maximum: 10, default: 1, description: 'Zoom level.' },
          },
          required: ['image_url'],
        },
      },
      {
        name: 'generate_music',
        description: 'Generate music from a text description (powered by ElevenLabs). Describe genre, mood, instruments, and tempo.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Describe the music (e.g. "Upbeat jazz with piano and drums", "Cinematic dramatic orchestral score").' },
            duration_seconds: { type: 'integer', minimum: 10, maximum: 240, default: 30 },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'isolate_audio',
        description: 'Extract a specific sound from an audio or video file (powered by SAM Audio). Describe what sound to isolate.',
        inputSchema: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'Describe the sound to isolate (e.g. "A person speaking", "Piano playing", "Dog barking").' },
            audio_url: { type: 'string', description: 'Public URL of the audio file (WAV, MP3, FLAC, OGG, M4A). Either this or video_url required.' },
            video_url: { type: 'string', description: 'Public URL of the video file (MP4, MOV, WEBM, AVI). Either this or audio_url required.' },
          },
          required: ['description'],
        },
      },
      {
        name: 'check_task',
        description: 'Check the status of any async task and get the result URL(s). Use the status_url returned by any generate_* call.',
        inputSchema: {
          type: 'object',
          properties: {
            status_url: { type: 'string' },
          },
          required: ['status_url'],
        },
      },
      {
        name: 'list_models',
        description: 'List all available models and tools.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {

      // ── list_models ──────────────────────────────────────────────────────
      if (name === 'list_models') {
        return { content: [{ type: 'text', text:
          `**Image generation (${Object.keys(IMAGE_MODELS).length} models):**\n` +
          Object.entries(IMAGE_MODELS).map(([k, v]) => `  - ${k}${v.supportsRefs ? ' [refs supported]' : ''}`).join('\n') +
          `\n\n**Image-to-video (${Object.keys(VIDEO_MODELS).length} models):**\n` +
          Object.keys(VIDEO_MODELS).map((m) => `  - ${m}`).join('\n') +
          `\n\n**Text-to-video (${Object.keys(TEXT_VIDEO_MODELS).length} models):**\n` +
          Object.keys(TEXT_VIDEO_MODELS).map((m) => `  - ${m}`).join('\n') +
          `\n\n**Image editing tools:** remove_background, upscale_image (creative/precision), expand_image (flux-pro/seedream/ideogram), relight_image, style_transfer, change_camera` +
          `\n\n**Audio tools:** generate_music, isolate_audio`,
        }]};
      }

      // ── generate_image ───────────────────────────────────────────────────
      if (name === 'generate_image') {
        const { prompt, model = 'nano-banana-pro-flash', reference_images, aspect_ratio = 'square_1_1', resolution = '2k', negative_prompt, seed } = args;
        const spec = IMAGE_MODELS[model];
        if (!spec) return { content: [{ type: 'text', text: `Unknown model: ${model}` }] };

        const refs = await loadImages(reference_images);
        const useEdit = refs.length > 0 && spec.editEndpoint;
        if (refs.length > 0 && !spec.supportsRefs) {
          return { content: [{ type: 'text', text: `Model "${model}" does not support reference_images.` }] };
        }
        const endpoint = useEdit ? spec.editEndpoint : spec.endpoint;
        const body = { prompt, aspect_ratio };
        if (refs.length > 0 && spec.supportsRefs && !useEdit) body.reference_images = refs;
        if (useEdit) body.reference_images = refs;
        if (model === 'mystic') body.resolution = resolution;
        if (negative_prompt) body.negative_prompt = negative_prompt;
        if (seed != null) body.seed = seed;

        const task = await runAsync(endpoint, body);
        if (task.done) return { content: [{ type: 'text', text: `Image ready (${model}):\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Image ready (${model})${useEdit ? ' [edit]' : ''}:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── generate_video ───────────────────────────────────────────────────
      if (name === 'generate_video') {
        const { image, prompt, negative_prompt, model = 'kling-v2-6-pro', duration = '5', cfg_scale = 0.5 } = args;
        const endpoint = VIDEO_MODELS[model];
        if (!endpoint) return { content: [{ type: 'text', text: `Unknown model: ${model}` }] };
        const body = { image: await loadImage(image), duration, cfg_scale };
        if (prompt) body.prompt = prompt;
        if (negative_prompt) body.negative_prompt = negative_prompt;
        const data = await postJson(endpoint, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${endpoint}/${taskId}`;
        return { content: [{ type: 'text', text: `Video started (${model}, ${duration}s)\ntask_id: ${taskId}\nstatus_url: ${statusUrl}\n\nVideos take 1-4 min. Use check_task to get the result.` }] };
      }

      // ── generate_video_from_text ─────────────────────────────────────────
      if (name === 'generate_video_from_text') {
        const { prompt, negative_prompt, model = 'wan-2-7-t2v', duration = '5' } = args;
        const endpoint = TEXT_VIDEO_MODELS[model];
        if (!endpoint) return { content: [{ type: 'text', text: `Unknown model: ${model}` }] };
        const body = { prompt, duration };
        if (negative_prompt) body.negative_prompt = negative_prompt;
        const data = await postJson(endpoint, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${endpoint}/${taskId}`;
        return { content: [{ type: 'text', text: `Text-to-video started (${model}, ${duration}s)\ntask_id: ${taskId}\nstatus_url: ${statusUrl}\n\nUse check_task to retrieve the video.` }] };
      }

      // ── remove_background ────────────────────────────────────────────────
      if (name === 'remove_background') {
        const { image_url } = args;
        const res = await fetch(`${BASE}/beta/remove-background`, {
          method: 'POST', headers, body: JSON.stringify({ image_url }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`);
        const urls = extractUrls(data);
        return { content: [{ type: 'text', text: urls.length ? `Background removed:\n${urls.join('\n')}` : JSON.stringify(data, null, 2) }] };
      }

      // ── upscale_image ────────────────────────────────────────────────────
      if (name === 'upscale_image') {
        const { image_url, mode = 'creative', scale_factor = 2 } = args;
        const endpoint = mode === 'precision'
          ? `${BASE}/image-upscaler-precision-v2`
          : `${BASE}/image-upscaler`;
        const body = { image_url, scale_factor };
        const task = await runAsync(endpoint, body);
        if (task.done) return { content: [{ type: 'text', text: `Upscaled (${mode}):\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Upscaled (${mode}):\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── expand_image ─────────────────────────────────────────────────────
      if (name === 'expand_image') {
        const { image_url, prompt, expand_top = 0, expand_bottom = 0, expand_left = 0, expand_right = 0, engine = 'flux-pro' } = args;
        const endpoint = `${BASE}/image-expand/${engine}`;
        const body = { image_url, top: expand_top, bottom: expand_bottom, left: expand_left, right: expand_right };
        if (prompt) body.prompt = prompt;
        const task = await runAsync(endpoint, body);
        if (task.done) return { content: [{ type: 'text', text: `Expanded (${engine}):\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Expanded (${engine}):\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── relight_image ────────────────────────────────────────────────────
      if (name === 'relight_image') {
        const { image_url, prompt, reference_image_url, lightmap_url } = args;
        const body = { image_url, prompt };
        if (reference_image_url) body.reference_image_url = reference_image_url;
        if (lightmap_url) body.lightmap_url = lightmap_url;
        const task = await runAsync(`${BASE}/image-relight`, body);
        if (task.done) return { content: [{ type: 'text', text: `Relit:\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Relit:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── style_transfer ───────────────────────────────────────────────────
      if (name === 'style_transfer') {
        const { image_url, style_image_url, prompt, strength = 0.8 } = args;
        const body = { image_url, style_image_url, strength };
        if (prompt) body.prompt = prompt;
        const task = await runAsync(`${BASE}/image-style-transfer`, body);
        if (task.done) return { content: [{ type: 'text', text: `Style transferred:\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Style transferred:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── change_camera ────────────────────────────────────────────────────
      if (name === 'change_camera') {
        const { image_url, horizontal_rotation = 45, vertical_tilt = 0, zoom = 1 } = args;
        const body = { image_url, horizontal_rotation, vertical_tilt, zoom };
        const task = await runAsync(`${BASE}/image-change-camera`, body);
        if (task.done) return { content: [{ type: 'text', text: `Camera changed:\n${task.urls.join('\n')}` }] };
        try {
          const result = await pollTask(task.statusUrl);
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Camera changed:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${task.statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── generate_music ───────────────────────────────────────────────────
      if (name === 'generate_music') {
        const { prompt, duration_seconds = 30 } = args;
        const data = await postJson(`${BASE}/music-generation`, { prompt, music_length_seconds: duration_seconds });
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${BASE}/music-generation/${taskId}`;
        try {
          const result = await pollTask(statusUrl, { maxWaitMs: 180000 });
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Music ready:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── isolate_audio ────────────────────────────────────────────────────
      if (name === 'isolate_audio') {
        const { description, audio_url, video_url } = args;
        if (!audio_url && !video_url) return { content: [{ type: 'text', text: 'Provide either audio_url or video_url.' }] };
        const body = { description };
        if (audio_url) body.audio = audio_url;
        if (video_url) body.video = video_url;
        const data = await postJson(`${BASE}/audio-isolation`, body);
        const taskId = data?.data?.task_id || data?.task_id;
        const statusUrl = `${BASE}/audio-isolation/${taskId}`;
        try {
          const result = await pollTask(statusUrl, { maxWaitMs: 180000 });
          const urls = extractUrls(result);
          return { content: [{ type: 'text', text: `Audio isolated:\n${urls.length ? urls.join('\n') : JSON.stringify(result.data, null, 2)}` }] };
        } catch (e) {
          return { content: [{ type: 'text', text: `Started but timed out. status_url: ${statusUrl}\n\n${e.message}` }] };
        }
      }

      // ── check_task ───────────────────────────────────────────────────────
      if (name === 'check_task') {
        const { status_url } = args;
        const res = await fetch(status_url, { headers });
        const data = await res.json();
        const status = data?.data?.status || data?.status || 'unknown';
        const urls = extractUrls(data);
        return { content: [{ type: 'text', text: `Status: ${status}\n${urls.length ? urls.join('\n') : JSON.stringify(data?.data || data, null, 2)}` }] };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }] };
    }
  });

  return server;
}

// ─── EXPRESS APP ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

function requireAuth(req, res, next) {
  if (!MCP_AUTH_TOKEN) return next();
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${MCP_AUTH_TOKEN}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/', (_req, res) => res.json({ status: 'ok', name: 'magnific-mcp', version: '3.0.0' }));

app.post('/mcp', requireAuth, async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => console.log(`magnific-mcp v3 running on port ${PORT}`));
