/**
 * Flashcards sync API:
 *  - Email+password auth with 6-digit email verification codes
 *  - JWT (no expiry) + password reset by email
 *  - Shared library: lessons/cards/files visible to all authenticated users
 *  - File uploads to disk
 *
 * Env: PORT, CORS_ORIGIN, JWT_SECRET, UPLOAD_DIR,
 *      BREVO_SMTP_LOGIN, BREVO_SMTP_KEY (prefer),
 *      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_TLS_INSECURE, MAIL_FROM
 */
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { sendCode } from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'flashcards-dev-secret-change-in-production';
const SALT_ROUNDS = 10;
const CODE_TTL_MS = 15 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 6;

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
      pending: Array.isArray(data.pending) ? data.pending : [],
      lessons: Array.isArray(data.lessons) ? data.lessons : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
      files: Array.isArray(data.files) ? data.files : [],
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      const empty = { users: [], pending: [], lessons: [], cards: [], files: [] };
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

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET);
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

function isValidEmail(value) {
  return (
    typeof value === 'string' &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

async function prunePending(db) {
  const now = Date.now();
  const initial = db.pending.length;
  db.pending = db.pending.filter((p) => p.expiresAt > now);
  if (db.pending.length !== initial) {
    await writeDb(db);
  }
}

// --- AUTH: email verification ---

app.post('/auth/request-code', async (req, res) => {
  const { email, password, purpose } = req.body ?? {};
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Некорректный e-mail' });
    return;
  }
  const kind = purpose === 'reset' ? 'reset' : 'register';
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    return;
  }

  const db = await readDb();
  await prunePending(db);

  const normalized = normalizeEmail(email);
  const existing = db.users.find((u) => u.email === normalized);

  if (kind === 'register' && existing) {
    res.status(409).json({ error: 'Этот e-mail уже зарегистрирован' });
    return;
  }
  if (kind === 'reset' && !existing) {
    res.status(404).json({ error: 'Пользователь с таким e-mail не найден' });
    return;
  }

  const code = generateCode();
  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  db.pending = db.pending.filter(
    (p) => !(p.email === normalized && p.purpose === kind)
  );
  db.pending.push({
    id: crypto.randomUUID(),
    email: normalized,
    code,
    passwordHash,
    purpose: kind,
    attempts: 0,
    createdAt: nowIso(),
    expiresAt: Date.now() + CODE_TTL_MS,
  });
  await writeDb(db);

  try {
    await sendCode(normalized, code, kind);
  } catch (e) {
    console.error('[Mail] send failed', e);
    res.status(502).json({ error: 'Не удалось отправить письмо. Попробуйте позже.' });
    return;
  }

  console.log('[API] /auth/request-code', normalized, kind);
  res.json({ ok: true, ttlSeconds: Math.floor(CODE_TTL_MS / 1000) });
});

app.post('/auth/verify-code', async (req, res) => {
  const { email, code, purpose } = req.body ?? {};
  if (!isValidEmail(email) || typeof code !== 'string') {
    res.status(400).json({ error: 'email и code обязательны' });
    return;
  }
  const kind = purpose === 'reset' ? 'reset' : 'register';
  const normalized = normalizeEmail(email);
  const cleanCode = code.trim();

  const db = await readDb();
  await prunePending(db);

  const idx = db.pending.findIndex(
    (p) => p.email === normalized && p.purpose === kind
  );
  if (idx < 0) {
    res.status(400).json({ error: 'Запросите код заново — предыдущий истёк' });
    return;
  }
  const pending = db.pending[idx];
  if (pending.expiresAt < Date.now()) {
    db.pending.splice(idx, 1);
    await writeDb(db);
    res.status(400).json({ error: 'Срок действия кода истёк' });
    return;
  }
  pending.attempts = (pending.attempts ?? 0) + 1;
  if (pending.attempts > CODE_MAX_ATTEMPTS) {
    db.pending.splice(idx, 1);
    await writeDb(db);
    res.status(429).json({ error: 'Слишком много попыток. Запросите новый код.' });
    return;
  }
  if (pending.code !== cleanCode) {
    await writeDb(db);
    res.status(400).json({ error: 'Неверный код' });
    return;
  }

  if (kind === 'register') {
    const existing = db.users.find((u) => u.email === normalized);
    let userId;
    if (existing) {
      existing.emailVerified = true;
      existing.passwordHash = pending.passwordHash;
      userId = existing.id;
    } else {
      userId = crypto.randomUUID();
      db.users.push({
        id: userId,
        email: normalized,
        passwordHash: pending.passwordHash,
        emailVerified: true,
        createdAt: nowIso(),
      });
    }
    db.pending.splice(idx, 1);
    await writeDb(db);
    const token = signToken(userId);
    console.log('[API] /auth/verify-code register ->', userId);
    res.status(201).json({ token, userId, email: normalized });
    return;
  }

  // reset
  const user = db.users.find((u) => u.email === normalized);
  if (!user) {
    db.pending.splice(idx, 1);
    await writeDb(db);
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  user.passwordHash = pending.passwordHash;
  db.pending.splice(idx, 1);
  await writeDb(db);
  const token = signToken(user.id);
  console.log('[API] /auth/verify-code reset ->', user.id);
  res.json({ token, userId: user.id, email: normalized });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!isValidEmail(email) || typeof password !== 'string') {
    res.status(400).json({ error: 'email и password обязательны' });
    return;
  }
  const normalized = normalizeEmail(email);
  const db = await readDb();
  const user = db.users.find((u) => u.email === normalized);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: 'Неверный e-mail или пароль' });
    return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: 'E-mail не подтверждён. Завершите регистрацию.' });
    return;
  }
  const token = signToken(user.id);
  console.log('[API] /auth/login ->', user.id);
  res.json({ token, userId: user.id, email: user.email });
});

app.get('/auth/me', authMiddleware, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((u) => u.id === req.userId);
  if (!user) {
    res.status(404).json({ error: 'user not found' });
    return;
  }
  res.json({ id: user.id, email: user.email, emailVerified: !!user.emailVerified });
});

// --- Shared library: lessons/cards/files ---

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
