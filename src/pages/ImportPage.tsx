import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '../db';
import type { Lesson } from '../db';
import { parseImportFile } from '../utils/importParser';

const TEMPLATE_CSV = `RU|KZ
Коричневый|қоңыр
Мишка|қонжық
Серый|сұр
Оранжевый|қызғылт/сары`;
const NEW_LESSON_VALUE = '__new__';
const LESSON_NAME_MAX_LENGTH = 60;

function validateLessonName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Lesson name is required';
  if (trimmed.length > LESSON_NAME_MAX_LENGTH) {
    return `Max ${LESSON_NAME_MAX_LENGTH} characters`;
  }
  return null;
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
  const navigate = useNavigate();
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

  const isCreatingLesson = lessonId === NEW_LESSON_VALUE;
  const canUpload =
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
    setLessonError(null);
    setParseError(null);

    if (!lessonId.trim()) {
      setLessonError('Please select a lesson');
      return;
    }

    setUploading(true);
    try {
      const rows = await parseImportFile(file);
      console.log('[Import] parsed rows', rows.length);
      if (rows.length === 0) {
        setParseError('No valid rows found. Use format RU|KZ (or ; or ,). One pair per line.');
        setUploading(false);
        return;
      }

      let targetLessonId = lessonId;
      let targetLessonName = '';
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
      } else {
        const lesson = await getLessonById(lessonId);
        targetLessonName = lesson?.name ?? 'Lesson';
      }

      console.log('[Import] target lesson', {
        id: targetLessonId,
        name: targetLessonName,
      });

      const cards = rows.map((row) => ({
        userId,
        folderId: targetLessonId,
        frontText: row.frontText,
        backText: row.backText,
      }));
      const insertedCount = await bulkCreateCards(cards);
      console.log('[Import] cards inserted', insertedCount);

      navigate('/import/success', {
        replace: true,
        state: { lessonName: targetLessonName, count: rows.length },
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Import words
      </Typography>

      <FormControl fullWidth sx={{ mt: 2, mb: 2 }} error={showLessonError}>
        <InputLabel id="import-lesson-label">Lesson</InputLabel>
        <Select
          labelId="import-lesson-label"
          id="import-lesson"
          value={lessonId}
          label="Lesson"
          onChange={(e) => handleLessonChange(e.target.value)}
        >
          <MenuItem value="">
            <em>Select a lesson</em>
          </MenuItem>
          <MenuItem value={NEW_LESSON_VALUE}>
            <em>Create new lesson</em>
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
          label="Lesson name"
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
          Download template
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Format: RU|KZ (Russian|Kazakh). Delimiter: | or ; or , . Optional header row RU|KZ. Slashes in values are kept (e.g. қызғылт/сары).
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" component="label" fullWidth>
          Choose file (.csv or .xlsx)
          <input
            type="file"
            hidden
            accept=".csv,.xlsx"
            onChange={handleFileChange}
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
        {uploading ? 'Importing…' : 'Upload'}
      </Button>
    </Box>
  );
}
