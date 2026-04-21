import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { useAuthStore } from '../features/auth/authStore';
import {
  getLessonsByUserId,
  getCardsByUserId,
  createLesson as createLessonLocal,
  bulkUpsertLessons,
  type Lesson,
} from '../db';
import { createLesson as createLessonCloud, isCloudApiConfigured } from '../services/lessonsApi';

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

export function FoldersPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cardCountByLessonId, setCardCountByLessonId] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOnline, setCreateOnline] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const loadData = useCallback(async () => {
    if (!userId) return;
    const [lessonList, cards] = await Promise.all([
      getLessonsByUserId(userId),
      getCardsByUserId(userId),
    ]);
    setLessons(lessonList);
    const counts: Record<string, number> = {};
    for (const card of cards) {
      counts[card.folderId] = (counts[card.folderId] ?? 0) + 1;
    }
    setCardCountByLessonId(counts);
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const hasLessons = lessons.length > 0;
  const cloudAvailable = isOnline && isCloudApiConfigured;
  const cloudDisabledReason = !isOnline
    ? 'Нет сети — облако недоступно'
    : !isCloudApiConfigured
      ? 'Не задан VITE_API_BASE_URL'
      : null;
  const onlineHelperText = cloudDisabledReason
    ? cloudDisabledReason
    : createOnline
      ? 'Папка и карточки сохранятся на сервере и подтянутся на другие устройства после синхронизации.'
      : 'Только на этом устройстве (работает оффлайн).';

  const handleCreateOpen = () => {
    setCreateName('');
    setCreateError(null);
    setCreateOnline(cloudAvailable);
    setCreateOpen(true);
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setCreateName('');
    setCreateError(null);
  };

  const handleCreateSubmit = async () => {
    if (!userId) return;
    const err = validateLessonName(createName);
    if (err) {
      setCreateError(err);
      return;
    }

    const name = createName.trim();

    try {
      if (createOnline) {
        if (!cloudAvailable) {
          setCreateError(cloudDisabledReason ?? 'Облако недоступно');
          return;
        }
        const payload = {
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const response = await createLessonCloud(payload);
        const createdAt = parseEpoch(response.createdAt) ?? Date.now();
        const updatedAt = parseEpoch(response.updatedAt) ?? createdAt;
        await bulkUpsertLessons([
          {
            id: response.id,
            userId,
            name: response.name ?? name,
            createdAt,
            updatedAt,
            source: 'cloud',
          },
        ]);
      } else {
        await createLessonLocal({
          userId,
          name,
          source: 'local',
        });
      }
      handleCreateClose();
      await loadData();
    } catch (error) {
      console.error('[Folder Create] failed', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('401')) {
        setCreateError('Облачная сессия истекла. Выйдите и войдите снова, чтобы возобновить синхронизацию.');
      } else {
        setCreateError('Не удалось создать облачную папку. Попробуйте ещё раз или создайте локально.');
      }
    }
  };

  const totalCards = Object.values(cardCountByLessonId).reduce((a, b) => a + b, 0);

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, mb: 0.5 }}>
          Мои папки
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Выбери папку для тренировки. Облачные папки синхронизируются между устройствами.
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ bgcolor: 'rgba(28,176,246,0.08)', borderColor: 'secondary.light' }}>
        <CardContent sx={{ py: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <SchoolRoundedIcon color="secondary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Прогресс
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            Всего карточек: {totalCards}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={hasLessons ? Math.min(100, totalCards * 3) : 0}
            sx={{
              height: 12,
              borderRadius: 99,
              bgcolor: 'rgba(88,204,2,0.2)',
              '& .MuiLinearProgress-bar': { borderRadius: 99 },
            }}
          />
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          fullWidth
          startIcon={<AddRoundedIcon />}
          onClick={handleCreateOpen}
        >
          Новая папка
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="large"
          fullWidth
          startIcon={<SchoolRoundedIcon />}
          onClick={() => navigate('/train')}
          disabled={!hasLessons}
        >
          Тренировка
        </Button>
      </Stack>

      {!hasLessons ? (
        <Card>
          <CardContent>
            <Stack alignItems="center" spacing={1} sx={{ py: 3 }}>
              <FolderRoundedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary" align="center" sx={{ fontWeight: 700 }}>
                Пока нет папок. Создай первую — или подключись к интернету для синхронизации с облаком.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {lessons.map((lesson) => {
            const n = cardCountByLessonId[lesson.id] ?? 0;
            const isCloud = lesson.source === 'cloud';
            return (
              <Card key={lesson.id}>
                <CardActionArea onClick={() => navigate('/import')}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: isCloud ? 'primary.light' : 'grey.300',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isCloud ? 'primary.dark' : 'grey.700',
                      }}
                    >
                      {isCloud ? <CloudDoneRoundedIcon /> : <FolderRoundedIcon />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                        {lesson.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {n} {n === 1 ? 'карточка' : n < 5 ? 'карточки' : 'карточек'}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={isCloud ? 'Облако' : 'Локально'}
                      color={isCloud ? 'success' : 'default'}
                      sx={{ fontWeight: 800 }}
                    />
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}

      <Dialog open={createOpen} onClose={handleCreateClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Новая папка</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Название"
            value={createName}
            onChange={(e) => {
              setCreateName(e.target.value);
              setCreateError(null);
            }}
            error={!!createError}
            helperText={createError}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: LESSON_NAME_MAX_LENGTH }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={createOnline}
                onChange={(e) => setCreateOnline(e.target.checked)}
                disabled={!!cloudDisabledReason}
                color="primary"
              />
            }
            label="Сохранить в облаке"
          />
          <FormHelperText>{onlineHelperText}</FormHelperText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCreateClose}>Отмена</Button>
          <Button variant="contained" onClick={handleCreateSubmit}>
            Создать
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
