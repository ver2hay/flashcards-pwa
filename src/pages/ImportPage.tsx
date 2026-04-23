import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { useAuthStore } from '../features/auth/authStore';
import {
  getLessonsByUserId,
  getLessonById,
  createLesson,
  bulkCreateCards,
  bulkUpsertCards,
  upsertLessonFiles,
} from '../db';
import type { Lesson } from '../db';
import { parseImportFile } from '../utils/importParser';
import { createLessonCards } from '../services/lessonsApi';
import { uploadLessonFile } from '../services/filesApi';

const TEMPLATE_CSV = `RU|KZ
Коричневый|қоңыр
Мишка|қонжық
Серый|сұр
Оранжевый|қызғылт/сары`;
const NEW_LESSON_VALUE = '__new__';
const LESSON_NAME_MAX_LENGTH = 60;

function validateLessonName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Введите название папки';
  if (trimmed.length > LESSON_NAME_MAX_LENGTH) {
    return `Не больше ${LESSON_NAME_MAX_LENGTH} символов`;
  }
  return null;
}

function parseEpoch(value?: string | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function downloadTemplate(): void {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'flashcards-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const userId = useAuthStore((state) => state.userId);
  const role = useAuthStore((state) => state.role);
  const navigate = useNavigate();
  const location = useLocation();
  const presetLessonId = (location.state as { presetLessonId?: string } | null)
    ?.presetLessonId;
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState<string>('');
  const [newLessonName, setNewLessonName] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadLessons = useCallback(async () => {
    if (!userId) return;
    const list = await getLessonsByUserId(userId);
    console.log('[Import] lessons loaded', list.length);
    setLessons(list);
  }, [userId]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  useEffect(() => {
    if (presetLessonId) {
      setLessonId(presetLessonId);
    }
  }, [presetLessonId]);

  const selectedLesson = lessons.find((l) => l.id === lessonId);
  const importReadOnly =
    !!selectedLesson &&
    selectedLesson.source === 'cloud' &&
    !!selectedLesson.cloudCreatedBy &&
    selectedLesson.cloudCreatedBy !== userId &&
    role !== 'admin';

  const isCreatingLesson = lessonId === NEW_LESSON_VALUE;
  const canUpload =
    !importReadOnly &&
    !!lessonId &&
    !!file &&
    !uploading &&
    (!isCreatingLesson || newLessonName.trim().length > 0);
  const showLessonError = lessonError !== null;
  const showParseError = parseError !== null;

  const handleLessonChange = (value: string) => {
    setLessonId(value);
    setLessonError(null);
    setParseError(null);
    if (value !== NEW_LESSON_VALUE) {
      setNewLessonName('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setParseError(null);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!userId || !lessonId || !file) return;
    if (importReadOnly) return;
    setLessonError(null);
    setParseError(null);

    if (!lessonId.trim()) {
      setLessonError('Выберите папку');
      return;
    }

    setUploading(true);
    try {
      const rows = await parseImportFile(file);
      console.log('[Import] parsed rows', rows.length);
      if (rows.length === 0) {
        setParseError('Нет строк для импорта. Формат: RU|KZ, по одной паре в строке.');
        setUploading(false);
        return;
      }

      let targetLessonId = lessonId;
      let targetLessonName = '';
      let targetLessonSource: Lesson['source'] = 'local';
      if (lessonId === NEW_LESSON_VALUE) {
        const nameError = validateLessonName(newLessonName);
        if (nameError) {
          setLessonError(nameError);
          setUploading(false);
          return;
        }
        const created = await createLesson({
          userId,
          name: newLessonName.trim(),
          source: 'local',
        });
        targetLessonId = created.id;
        targetLessonName = created.name;
        targetLessonSource = created.source;
      } else {
        const lesson = await getLessonById(lessonId);
        targetLessonName = lesson?.name ?? 'Lesson';
        targetLessonSource = lesson?.source ?? 'local';
      }

      console.log('[Import] target lesson', {
        id: targetLessonId,
        name: targetLessonName,
        source: targetLessonSource,
      });

      if (targetLessonSource === 'cloud') {
        console.log('[Import] uploading source file to cloud');
        const uploaded = await uploadLessonFile(targetLessonId, file);
        await upsertLessonFiles([
          {
            id: uploaded.id,
            userId,
            lessonId: targetLessonId,
            name: uploaded.name,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
            createdAt: parseEpoch(uploaded.createdAt) ?? Date.now(),
            blob: file,
          },
        ]);
        console.log('[Import] uploading cards to cloud');
        const remoteCards = await createLessonCards(
          targetLessonId,
          rows.map((row) => ({
            frontText: row.frontText,
            backText: row.backText,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        );
        console.log('[Import] cloud cards response', remoteCards.length);
        const cards = remoteCards.map((card) => ({
          id: card.id,
          userId,
          folderId: targetLessonId,
          frontText: card.frontText,
          backText: card.backText,
          createdAt: parseEpoch(card.createdAt) ?? Date.now(),
        }));
        const insertedCount = await bulkUpsertCards(cards);
        console.log('[Import] cards inserted', insertedCount);
      } else {
        const cards = rows.map((row) => ({
          userId,
          folderId: targetLessonId,
          frontText: row.frontText,
          backText: row.backText,
        }));
        const insertedCount = await bulkCreateCards(cards);
        console.log('[Import] cards inserted', insertedCount);
      }

      navigate('/import/success', {
        replace: true,
        state: { lessonName: targetLessonName, count: rows.length },
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Не удалось выполнить импорт');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        Импорт слов
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
        Для облачных папок файл сначала загружается на сервер, затем карточки — на других устройствах
        подтянутся при синхронизации.
      </Typography>

      {importReadOnly && (
        <Alert severity="info" sx={{ mb: 2, fontWeight: 600 }}>
          Эта папка опубликована другим пользователем — добавлять слова можно только в свои папки
          (или правит администратор).
        </Alert>
      )}

      <FormControl fullWidth sx={{ mt: 2, mb: 2 }} error={showLessonError}>
        <InputLabel id="import-lesson-label">Папка</InputLabel>
        <Select
          labelId="import-lesson-label"
          id="import-lesson"
          value={lessonId}
          label="Папка"
          onChange={(e) => handleLessonChange(e.target.value)}
        >
          <MenuItem value="">
            <em>Выберите папку</em>
          </MenuItem>
          <MenuItem value={NEW_LESSON_VALUE}>
            <em>Создать новую папку</em>
          </MenuItem>
          {lessons.map((lesson) => (
            <MenuItem key={lesson.id} value={lesson.id}>
              {lesson.name}
            </MenuItem>
          ))}
        </Select>
        {showLessonError && (
          <FormHelperText>{lessonError}</FormHelperText>
        )}
      </FormControl>

      {isCreatingLesson && (
        <TextField
          label="Название папки"
          value={newLessonName}
          onChange={(e) => {
            setNewLessonName(e.target.value);
            setLessonError(null);
          }}
          error={showLessonError}
          helperText={lessonError}
          fullWidth
          margin="normal"
          inputProps={{ maxLength: LESSON_NAME_MAX_LENGTH }}
        />
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={downloadTemplate}
        >
          Скачать шаблон
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
        Формат: RU|KZ. Разделитель: | или ; или ,. Слеши в словах сохраняются (например қызғылт/сары).
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          component="label"
          fullWidth
          disabled={importReadOnly}
        >
          Выбрать файл (.csv или .xlsx)
          <input
            type="file"
            hidden
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            disabled={importReadOnly}
          />
        </Button>
        {file && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {file.name}
          </Typography>
        )}
      </Box>

      {showParseError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      )}

      <Button
        variant="contained"
        startIcon={<UploadIcon />}
        onClick={handleUpload}
        disabled={!canUpload}
        fullWidth
      >
        {uploading ? 'Импорт…' : 'Загрузить'}
      </Button>
    </Box>
  );
}
