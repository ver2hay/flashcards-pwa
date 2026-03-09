import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      lessons: Array.isArray(data.lessons) ? data.lessons : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const empty = { lessons: [], cards: [] };
      await fs.writeFile(DB_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    throw err;
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

app.get('/lessons', async (_req, res) => {
  const db = await readDb();
  console.log('[API] GET /lessons ->', db.lessons.length);
  res.json(db.lessons);
});

app.post('/lessons', async (req, res) => {
  const { name, createdAt, updatedAt } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const db = await readDb();
  const now = nowIso();
  const lesson = {
    id: crypto.randomUUID(),
    name: name.trim(),
    source: 'cloud',
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
  };
  db.lessons.push(lesson);
  await writeDb(db);
  console.log('[API] POST /lessons ->', lesson.id);
  res.status(201).json(lesson);
});

app.get('/lessons/:lessonId/cards', async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const cards = db.cards.filter((c) => c.lessonId === lessonId);
  console.log('[API] GET /lessons/%s/cards -> %d', lessonId, cards.length);
  res.json(cards);
});

app.post('/lessons/:lessonId/cards', async (req, res) => {
  const { lessonId } = req.params;
  const incoming = Array.isArray(req.body) ? req.body : req.body?.cards;
  if (!Array.isArray(incoming)) {
    res.status(400).json({ error: 'cards array is required' });
    return;
  }
  const db = await readDb();
  const now = nowIso();
  const created = incoming
    .map((card) => {
      if (!card || !card.frontText || !card.backText) return null;
      return {
        id: crypto.randomUUID(),
        lessonId,
        frontText: String(card.frontText),
        backText: String(card.backText),
        createdAt: card.createdAt ?? now,
        updatedAt: card.updatedAt ?? now,
      };
    })
    .filter(Boolean);
  db.cards.push(...created);
  await writeDb(db);
  console.log('[API] POST /lessons/%s/cards -> %d', lessonId, created.length);
  res.status(201).json(created);
});

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
