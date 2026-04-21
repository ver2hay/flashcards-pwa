/**
 * Flashcards sync API: JWT auth, user-scoped lessons/cards, file uploads to disk.
 * Env: PORT, CORS_ORIGIN, JWT_SECRET, UPLOAD_DIR
 */
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'flashcards-dev-secret-change-in-production';
const SALT_ROUNDS = 10;

await fs.mkdir(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${crypto.randomUUID()}-${safe}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      users: Array.isArray(data.users) ? data.users : [],
      lessons: Array.isArray(data.lessons) ? data.lessons : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
      files: Array.isArray(data.files) ? data.files : [],
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const empty = { users: [], lessons: [], cards: [], files: [] };
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

function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const token = h.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  const name = username.trim().slice(0, 64);
  if (name.length < 2) {
    res.status(400).json({ error: 'username too short' });
    return;
  }
  const db = await readDb();
  if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    res.status(409).json({ error: 'username already taken' });
    return;
  }
  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const user = {
    id,
    username: name,
    passwordHash,
    createdAt: nowIso(),
  };
  db.users.push(user);
  await writeDb(db);
  const token = jwt.sign({ sub: id }, JWT_SECRET, { expiresIn: '30d' });
  console.log('[API] POST /auth/register ->', id);
  res.status(201).json({ token, userId: id, username: name });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  const db = await readDb();
  const user = db.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
  console.log('[API] POST /auth/login ->', user.id);
  res.json({ token, userId: user.id, username: user.username });
});

// --- Shared library: lessons/cards/files are visible to every authenticated user.
// `createdBy` is kept for auditing only and does NOT affect visibility.

app.get('/lessons', authMiddleware, async (_req, res) => {
  const db = await readDb();
  console.log('[API] GET /lessons (shared) ->', db.lessons.length);
  res.json(db.lessons);
});

app.post('/lessons', authMiddleware, async (req, res) => {
  const { name, createdAt, updatedAt } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const db = await readDb();
  const now = nowIso();
  const lesson = {
    id: crypto.randomUUID(),
    createdBy: req.userId,
    name: name.trim(),
    source: 'cloud',
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
  };
  db.lessons.push(lesson);
  await writeDb(db);
  console.log('[API] POST /lessons ->', lesson.id, 'by', req.userId);
  res.status(201).json(lesson);
});

app.get('/lessons/:lessonId/cards', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const cards = db.cards.filter((c) => c.lessonId === lessonId);
  console.log('[API] GET /lessons/%s/cards -> %d', lessonId, cards.length);
  res.json(cards);
});

app.post('/lessons/:lessonId/cards', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const incoming = Array.isArray(req.body) ? req.body : req.body?.cards;
  if (!Array.isArray(incoming)) {
    res.status(400).json({ error: 'cards array is required' });
    return;
  }
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const now = nowIso();
  const created = incoming
    .map((card) => {
      if (!card || !card.frontText || !card.backText) return null;
      return {
        id: crypto.randomUUID(),
        createdBy: req.userId,
        lessonId,
        frontText: String(card.frontText),
        backText: String(card.backText),
        createdAt: card.createdAt ?? now,
        updatedAt: card.updatedAt ?? now,
      };
    })
    .filter(Boolean);
  db.cards.push(...created);
  lesson.updatedAt = now;
  await writeDb(db);
  console.log('[API] POST /lessons/%s/cards -> %d', lessonId, created.length);
  res.status(201).json(created);
});

app.get('/lessons/:lessonId/files', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const files = db.files.filter((f) => f.lessonId === lessonId);
  res.json(
    files.map((f) => ({
      id: f.id,
      lessonId: f.lessonId,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      createdAt: f.createdAt,
    }))
  );
});

app.post('/lessons/:lessonId/files', authMiddleware, upload.single('file'), async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'file field required' });
    return;
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  const record = {
    id,
    createdBy: req.userId,
    lessonId,
    name: req.file.originalname,
    mimeType: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
    createdAt: now,
    storageFileName: path.basename(req.file.path),
  };
  db.files.push(record);
  lesson.updatedAt = now;
  await writeDb(db);
  console.log('[API] POST /lessons/%s/files -> %s', lessonId, id);
  res.status(201).json({
    id: record.id,
    lessonId,
    name: record.name,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
  });
});

app.get('/lessons/:lessonId/files/:fileId/download', authMiddleware, async (req, res) => {
  const { lessonId, fileId } = req.params;
  const db = await readDb();
  const file = db.files.find((f) => f.id === fileId && f.lessonId === lessonId);
  if (!file) {
    res.status(404).json({ error: 'file not found' });
    return;
  }
  const diskPath = path.join(UPLOAD_DIR, file.storageFileName);
  try {
    await fs.access(diskPath);
  } catch {
    res.status(404).json({ error: 'file missing on disk' });
    return;
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
  res.sendFile(path.resolve(diskPath));
});

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
