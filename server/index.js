/**
 * Flashcards sync API:
 *  - Email+password auth with 6-digit email verification codes
 *  - JWT (no expiry) + password reset by email
 *  - Lessons: own + public; only admin publishes; admin user management
 *  - File uploads to disk
 *
 * Env: PORT, CORS_ORIGIN, JWT_SECRET, UPLOAD_DIR,
 *      ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD (optional first admin)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
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

function userRole(user) {
  return user && user.role === 'admin' ? 'admin' : 'user';
}

function isAdminUser(user) {
  return userRole(user) === 'admin';
}

function canAccessLesson(userId, lesson, user) {
  if (!lesson) return false;
  if (isAdminUser(user)) return true;
  if (lesson.createdBy === userId) return true;
  return lesson.public === true;
}

function canModifyLesson(userId, lesson, user) {
  if (!lesson) return false;
  if (isAdminUser(user)) return true;
  return lesson.createdBy === userId;
}

function nextPublicSortOrder(db) {
  const max = db.lessons
    .filter((l) => l.public === true)
    .reduce((m, l) => Math.max(m, Number(l.publicSortOrder) || 0), -1);
  return max + 1;
}

function sortLessonsForClient(lessons, userId, isAdmin) {
  const mine = lessons.filter((l) => l.createdBy === userId);
  const pubOthers = lessons.filter((l) => l.public === true && l.createdBy !== userId);
  const privOthers = lessons.filter((l) => !l.public && l.createdBy !== userId);
  const mineSorted = [...mine].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  const pubOthersSorted = [...pubOthers].sort(
    (a, b) =>
      (Number(a.publicSortOrder) || 0) - (Number(b.publicSortOrder) || 0) ||
      String(a.name).localeCompare(String(b.name), 'ru')
  );
  const privOthersSorted = [...privOthers].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'ru')
  );
  if (isAdmin) {
    return [...mineSorted, ...pubOthersSorted, ...privOthersSorted];
  }
  return [...mineSorted, ...pubOthersSorted];
}

async function loadRequestUser(req) {
  const db = await readDb();
  return db.users.find((u) => u.id === req.userId) ?? null;
}

async function ensureBootstrapAdmin() {
  const rawEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!rawEmail || typeof password !== 'string' || !password) return;
  const email = String(rawEmail).trim();
  if (!isValidEmail(email)) {
    console.warn('[API] ADMIN_BOOTSTRAP_EMAIL is invalid, skipping bootstrap');
    return;
  }
  const db = await readDb();
  const normalized = normalizeEmail(email);
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const existing = db.users.find((u) => u.email === normalized);
  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = hash;
    existing.emailVerified = true;
  } else {
    db.users.push({
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash: hash,
      emailVerified: true,
      role: 'admin',
      createdAt: nowIso(),
    });
  }
  await writeDb(db);
  console.log('[API] Bootstrap admin set for', normalized);
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
    if (e && e.code === 'MAIL_CONFIG') {
      res.status(503).json({
        error:
          'Сервер не настроен: для Gmail укажите в api.env пароль приложения (Google App Password) и перезапустите API. Настройка: myaccount.google.com → Безопасность → Пароли приложений.',
      });
      return;
    }
    const smtp = typeof e === 'object' && e && 'response' in e ? String(e.response) : '';
    if (smtp.includes('SmtpClientAuthentication is disabled')) {
      res.status(503).json({
        error:
          'Почта Outlook: для ящика отключён SMTP. Включите «Authenticated SMTP» (SMTP AUTH) в настройках учётной записи Microsoft, см. https://aka.ms/smtp_auth_disabled (или в Exchange Admin для организации), затем повторите.',
      });
      return;
    }
    if (
      e &&
      e.code === 'EAUTH' &&
      String(process.env.SMTP_HOST || '').includes('yandex')
    ) {
      if (smtp.includes('does not have access rights')) {
        res.status(503).json({
          error:
            'Яндекс.Почта: для ящика запрещён доступ из почтовых программ (SMTP). В веб-интерфейсе: Настройки → Почтовые программы → включите IMAP и доступ по протоколу (или создайте пароль приложения для «Почта»). После этого снова запросите код.',
        });
        return;
      }
      if (smtp.includes('Invalid user or password') || smtp.includes('authentication failed')) {
        res.status(503).json({
          error:
            'Яндекс.Почта: неверный логин/пароль для SMTP, или нужен «Пароль приложения» (id.yandex.ru → Безопасность) если включена двухфакторная аутентификация. Проверьте SMTP_USER и SMTP_PASS в api.env на сервере.',
        });
        return;
      }
    }
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
        role: 'user',
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
  res.json({
    id: user.id,
    email: user.email,
    emailVerified: !!user.emailVerified,
    role: userRole(user),
  });
});

// --- Admin ---

async function requireAdmin(req, res, next) {
  const user = await loadRequestUser(req);
  if (!user || !isAdminUser(user)) {
    res.status(403).json({ error: 'Нужны права администратора' });
    return;
  }
  next();
}

app.get('/admin/users', authMiddleware, requireAdmin, async (_req, res) => {
  const db = await readDb();
  res.json(
    db.users.map((u) => ({
      id: u.id,
      email: u.email,
      emailVerified: !!u.emailVerified,
      role: userRole(u),
      createdAt: u.createdAt,
    }))
  );
});

app.post('/admin/users', authMiddleware, requireAdmin, async (req, res) => {
  const { email, password, role: roleIn } = req.body ?? {};
  if (!isValidEmail(email) || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Нужны email и password (от 6 символов)' });
    return;
  }
  const role = roleIn === 'admin' ? 'admin' : 'user';
  const normalized = normalizeEmail(email);
  const db = await readDb();
  if (db.users.some((u) => u.email === normalized)) {
    res.status(409).json({ error: 'Пользователь с таким e-mail уже есть' });
    return;
  }
  const user = {
    id: crypto.randomUUID(),
    email: normalized,
    passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
    emailVerified: true,
    createdAt: nowIso(),
    role,
  };
  db.users.push(user);
  await writeDb(db);
  res.status(201).json({
    id: user.id,
    email: user.email,
    emailVerified: true,
    role,
    createdAt: user.createdAt,
  });
});

app.patch('/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
  const { userId: targetId } = req.params;
  const { role: nextRole } = req.body ?? {};
  if (nextRole !== 'admin' && nextRole !== 'user') {
    res.status(400).json({ error: 'role: admin | user' });
    return;
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === targetId);
  if (!user) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  user.role = nextRole;
  await writeDb(db);
  res.json({
    id: user.id,
    email: user.email,
    emailVerified: !!user.emailVerified,
    role: userRole(user),
    createdAt: user.createdAt,
  });
});

app.delete('/admin/users/:userId', authMiddleware, requireAdmin, async (req, res) => {
  const { userId: targetId } = req.params;
  if (targetId === req.userId) {
    res.status(400).json({ error: 'Нельзя удалить свою учётную запись' });
    return;
  }
  const db = await readDb();
  const idx = db.users.findIndex((u) => u.id === targetId);
  if (idx < 0) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  const toRemove = db.lessons.filter((l) => l.createdBy === targetId);
  for (const lesson of toRemove) {
    for (const f of db.files.filter((x) => x.lessonId === lesson.id)) {
      const diskPath = path.join(UPLOAD_DIR, f.storageFileName);
      await fs.unlink(diskPath).catch(() => {});
    }
  }
  const removeIds = new Set(toRemove.map((l) => l.id));
  db.files = db.files.filter((f) => !removeIds.has(f.lessonId));
  db.cards = db.cards.filter((c) => !removeIds.has(c.lessonId));
  db.lessons = db.lessons.filter((l) => !removeIds.has(l.id));
  db.users.splice(idx, 1);
  await writeDb(db);
  res.json({ ok: true });
});

// --- Lessons (visibility: own + public) ---

app.get('/lessons', authMiddleware, async (req, res) => {
  const db = await readDb();
  const me = await loadRequestUser(req);
  const raw = isAdminUser(me)
    ? db.lessons
    : db.lessons.filter(
        (l) => l.createdBy === req.userId || l.public === true
      );
  const list = sortLessonsForClient(raw, req.userId, isAdminUser(me));
  console.log('[API] GET /lessons ->', list.length, isAdminUser(me) ? 'admin' : 'user');
  res.json(list);
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
    public: false,
    publicSortOrder: 0,
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? now,
  };
  db.lessons.push(lesson);
  await writeDb(db);
  console.log('[API] POST /lessons ->', lesson.id, 'by', req.userId);
  res.status(201).json(lesson);
});

app.patch('/lessons/:lessonId', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const { public: pub, name } = req.body ?? {};
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const me = await loadRequestUser(req);
  if (typeof name === 'string' && name.trim()) {
    if (!canModifyLesson(req.userId, lesson, me)) {
      res.status(403).json({ error: 'Нет прав' });
      return;
    }
    lesson.name = name.trim();
  }
  if (typeof pub === 'boolean') {
    if (!isAdminUser(me)) {
      res
        .status(403)
        .json({ error: 'Только администратор может менять публичность' });
      return;
    }
    if (pub && !lesson.public) {
      lesson.publicSortOrder = nextPublicSortOrder(db);
    }
    lesson.public = pub;
  }
  lesson.updatedAt = nowIso();
  await writeDb(db);
  res.json(lesson);
});

app.put(
  '/admin/lessons/public-order',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    const { orderedIds } = req.body ?? {};
    if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string')) {
      res.status(400).json({ error: 'orderedIds: массив id' });
      return;
    }
    const db = await readDb();
    const publicLessons = db.lessons.filter((l) => l.public === true);
    if (orderedIds.length !== publicLessons.length) {
      res.status(400).json({ error: 'Список должен содержать все общие папки' });
      return;
    }
    const idSet = new Set(orderedIds);
    if (idSet.size !== orderedIds.length) {
      res.status(400).json({ error: 'Повтор id' });
      return;
    }
    for (const id of orderedIds) {
      const l = db.lessons.find((x) => x.id === id);
      if (!l || !l.public) {
        res.status(400).json({ error: 'Неизвестная или непубличная папка' });
        return;
      }
    }
    orderedIds.forEach((id, i) => {
      const l = db.lessons.find((x) => x.id === id);
      if (l) l.publicSortOrder = i;
    });
    await writeDb(db);
    res.json({ ok: true });
  }
);

app.delete('/lessons/:lessonId', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const me = await loadRequestUser(req);
  if (!canModifyLesson(req.userId, lesson, me)) {
    res.status(403).json({ error: 'Нет прав' });
    return;
  }
  for (const f of db.files.filter((x) => x.lessonId === lessonId)) {
    const diskPath = path.join(UPLOAD_DIR, f.storageFileName);
    await fs.unlink(diskPath).catch(() => {});
  }
  db.files = db.files.filter((f) => f.lessonId !== lessonId);
  db.cards = db.cards.filter((c) => c.lessonId !== lessonId);
  db.lessons = db.lessons.filter((l) => l.id !== lessonId);
  await writeDb(db);
  res.json({ ok: true });
});

app.delete('/lessons/:lessonId/cards/:cardId', authMiddleware, async (req, res) => {
  const { lessonId, cardId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const me = await loadRequestUser(req);
  if (!canModifyLesson(req.userId, lesson, me)) {
    res.status(403).json({ error: 'Нет прав' });
    return;
  }
  const idx = db.cards.findIndex((c) => c.id === cardId && c.lessonId === lessonId);
  if (idx < 0) {
    res.status(404).json({ error: 'card not found' });
    return;
  }
  db.cards.splice(idx, 1);
  lesson.updatedAt = nowIso();
  await writeDb(db);
  res.json({ ok: true });
});

app.get('/lessons/:lessonId/cards', authMiddleware, async (req, res) => {
  const { lessonId } = req.params;
  const db = await readDb();
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    res.status(404).json({ error: 'lesson not found' });
    return;
  }
  const me = await loadRequestUser(req);
  if (!canAccessLesson(req.userId, lesson, me)) {
    res.status(403).json({ error: 'Нет доступа' });
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
  const me = await loadRequestUser(req);
  if (!canModifyLesson(req.userId, lesson, me)) {
    res.status(403).json({ error: 'Нет прав на изменение этой папки' });
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
  const me = await loadRequestUser(req);
  if (!canAccessLesson(req.userId, lesson, me)) {
    res.status(403).json({ error: 'Нет доступа' });
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
  const me = await loadRequestUser(req);
  if (!canModifyLesson(req.userId, lesson, me)) {
    if (req.file) await fs.unlink(req.file.path).catch(() => {});
    res.status(403).json({ error: 'Нет прав на изменение этой папки' });
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
  const lesson = db.lessons.find((l) => l.id === lessonId);
  if (lesson) {
    const me = await loadRequestUser(req);
    if (!canAccessLesson(req.userId, lesson, me)) {
      res.status(403).json({ error: 'Нет доступа' });
      return;
    }
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

await ensureBootstrapAdmin();

app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
});
