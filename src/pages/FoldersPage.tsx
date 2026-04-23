import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  IconButton,
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
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { useAuthStore } from '../features/auth/authStore';
import {
  getLessonsByUserId,
  getCardsByUserId,
  getCardsByFolderId,
  getLessonById,
  createLesson as createLessonLocal,
  bulkUpsertLessons,
  deleteLessons,
  deleteCard,
  type Lesson,
} from '../db';
import {
  createLesson as createLessonCloud,
  deleteLessonFromCloud,
  updateLesson,
  deleteLessonCard,
  isCloudApiConfigured,
} from '../services/lessonsApi';
import { syncLessons, LESSONS_SYNCED_EVENT } from '../services/syncService';
import { canEditCloudLesson, isForeignCloudLesson } from '../utils/lessonAccess';
import { sortLessonsForDisplay } from '../utils/lessonSort';
import { putPublicLessonsOrder } from '../services/adminApi';

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
  const role = useAuthStore((state) => state.role);
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cardCountByLessonId, setCardCountByLessonId] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOnline, setCreateOnline] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [cardsLesson, setCardsLesson] = useState<Lesson | null>(null);
  const [cardsRows, setCardsRows] = useState<
    Awaited<ReturnType<typeof getCardsByFolderId>>
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<Lesson | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

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
    if (!userId) return;
    const onSynced = () => {
      void loadData();
    };
    window.addEventListener(LESSONS_SYNCED_EVENT, onSynced);
    void (async () => {
      if (isCloudApiConfigured) {
        try {
          await syncLessons(userId);
        } catch (e) {
          console.warn('[Folders] sync on mount', e);
        }
      } else {
        await loadData();
      }
    })();
    return () => {
      window.removeEventListener(LESSONS_SYNCED_EVENT, onSynced);
    };
  }, [userId, loadData]);

  const displayLessons = useMemo(() => {
    if (!userId) return [];
    return sortLessonsForDisplay(lessons, userId, isAdmin);
  }, [lessons, userId, isAdmin]);

  const publicCloudSorted = useMemo(
    () =>
      [...lessons]
        .filter((l) => l.source === 'cloud' && l.isPublic === true)
        .sort(
          (a, b) =>
            (a.publicSortOrder ?? 0) - (b.publicSortOrder ?? 0) ||
            a.name.localeCompare(b.name, 'ru')
        ),
    [lessons]
  );

  useEffect(() => {
    if (!cardsLesson) {
      setCardsRows([]);
      return;
    }
    void getCardsByFolderId(cardsLesson.id).then(setCardsRows);
  }, [cardsLesson]);

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
            cloudCreatedBy: response.createdBy ?? userId,
            isPublic: response.public === true,
            publicSortOrder:
              typeof response.publicSortOrder === 'number'
                ? response.publicSortOrder
                : undefined,
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

  const handleDeleteFolder = async () => {
    if (!userId || !deleteTarget) return;
    const lesson = deleteTarget;
    setActionError(null);
    try {
      if (lesson.source === 'cloud' && isCloudApiConfigured) {
        await deleteLessonFromCloud(lesson.id);
      }
      await deleteLessons(userId, [lesson.id]);
      setDeleteTarget(null);
      await loadData();
      if (lesson.source === 'cloud' && isCloudApiConfigured) {
        await syncLessons(userId).catch(() => {});
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  const handleTogglePublic = async (lesson: Lesson, next: boolean) => {
    if (!userId || !isAdmin || !isCloudApiConfigured) return;
    setActionError(null);
    try {
      const updated = await updateLesson(lesson.id, { public: next });
      const uAt = parseEpoch(updated.updatedAt) ?? lesson.updatedAt;
      await bulkUpsertLessons([
        {
          ...lesson,
          isPublic: updated.public === true,
          name: updated.name ?? lesson.name,
          updatedAt: uAt,
          publicSortOrder:
            typeof updated.publicSortOrder === 'number'
              ? updated.publicSortOrder
              : lesson.publicSortOrder,
        },
      ]);
      await loadData();
      await syncLessons(userId).catch(() => {});
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleSaveRename = async () => {
    if (!userId || !renameTarget) return;
    const err = validateLessonName(renameValue);
    if (err) {
      setRenameError(err);
      return;
    }
    const name = renameValue.trim();
    setRenameError(null);
    setActionError(null);
    try {
      const lesson = renameTarget;
      if (lesson.source === 'cloud' && isCloudApiConfigured) {
        await updateLesson(lesson.id, { name });
        const u = await getLessonById(lesson.id);
        const base = u ?? lesson;
        const updatedAt = Date.now();
        await bulkUpsertLessons([
          {
            ...base,
            name,
            updatedAt,
          },
        ]);
        await syncLessons(userId);
      } else {
        const u = await getLessonById(lesson.id);
        const base = u ?? lesson;
        await bulkUpsertLessons([{ ...base, name, updatedAt: Date.now() }]);
      }
      setRenameTarget(null);
      await loadData();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleMovePublic = async (index: number, delta: number) => {
    if (!userId || publicCloudSorted.length < 2) return;
    const j = index + delta;
    if (j < 0 || j >= publicCloudSorted.length) return;
    const list = [...publicCloudSorted];
    const t = list[index];
    list[index] = list[j];
    list[j] = t;
    setActionError(null);
    try {
      await putPublicLessonsOrder(list.map((l) => l.id));
      await syncLessons(userId);
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось сохранить порядок');
    }
  };

  const handleDeleteCardRow = async (cardId: string) => {
    if (!userId || !cardsLesson) return;
    if (!canEditCloudLesson(cardsLesson, userId, isAdmin)) return;
    setActionError(null);
    try {
      if (cardsLesson.source === 'cloud' && isCloudApiConfigured) {
        await deleteLessonCard(cardsLesson.id, cardId);
      }
      await deleteCard(cardId);
      setCardsRows((prev) => prev.filter((c) => c.id !== cardId));
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось удалить карточку');
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
          Свои папки и папки, опубликованные администратором для всех. Импорт и правка — только в
          своих папках (или у админа — в любых).
        </Typography>
      </Box>

      {actionError && (
        <Typography color="error" variant="body2" sx={{ fontWeight: 700 }}>
          {actionError}
        </Typography>
      )}

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
          {displayLessons.map((lesson) => {
            const n = cardCountByLessonId[lesson.id] ?? 0;
            const isCloud = lesson.source === 'cloud';
            const canEdit = userId
              ? canEditCloudLesson(lesson, userId, isAdmin)
              : false;
            const foreign = userId ? isForeignCloudLesson(lesson, userId) : false;
            return (
              <Card key={lesson.id}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="flex-start" spacing={1.5}>
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
                          flexShrink: 0,
                        }}
                      >
                        {isCloud ? <CloudDoneRoundedIcon /> : <FolderRoundedIcon />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                            {lesson.name}
                          </Typography>
                          {isAdmin && lesson.source === 'cloud' && (
                            <IconButton
                              size="small"
                              aria-label="Переименовать"
                              onClick={() => {
                                setRenameTarget(lesson);
                                setRenameValue(lesson.name);
                                setRenameError(null);
                              }}
                            >
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {n}{' '}
                          {n === 1 ? 'карточка' : n < 5 ? 'карточки' : 'карточек'}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
                          <Chip
                            size="small"
                            label={isCloud ? 'Облако' : 'Локально'}
                            color={isCloud ? 'success' : 'default'}
                            sx={{ fontWeight: 800 }}
                          />
                          {isCloud && lesson.isPublic && (
                            <Chip
                              size="small"
                              icon={<CloudOutlinedIcon sx={{ fontSize: 16 }} />}
                              label="Для всех"
                              color="secondary"
                              variant="outlined"
                              sx={{ fontWeight: 800 }}
                            />
                          )}
                          {isCloud && foreign && (
                            <Chip
                              size="small"
                              icon={<PersonOutlineRoundedIcon sx={{ fontSize: 16 }} />}
                              label="Чужая"
                              sx={{ fontWeight: 800 }}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                    {isAdmin && isCloud && isCloudApiConfigured && (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={lesson.isPublic === true}
                            onChange={(_, v) => void handleTogglePublic(lesson, v)}
                            color="secondary"
                          />
                        }
                        label="Общий доступ (для всех пользователей)"
                        sx={{ m: 0, alignItems: 'center' }}
                      />
                    )}
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() =>
                          navigate('/import', { state: { presetLessonId: lesson.id } })
                        }
                        disabled={!canEdit}
                      >
                        Импорт
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ListAltRoundedIcon />}
                        onClick={() => setCardsLesson(lesson)}
                        disabled={!canEdit}
                      >
                        Слова
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate('/train')}
                      >
                        Урок
                      </Button>
                      {canEdit && (
                        <IconButton
                          aria-label="Удалить папку"
                          color="error"
                          onClick={() => setDeleteTarget(lesson)}
                          size="small"
                        >
                          <DeleteOutlineRoundedIcon />
                        </IconButton>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {hasLessons &&
        isAdmin &&
        isCloudApiConfigured &&
        publicCloudSorted.length > 0 && (
          <Card variant="outlined" sx={{ borderColor: 'secondary.light' }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                Порядок общих папок
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                Для всех пользователей: сначала их папки, затем общие — в порядке ниже.
              </Typography>
              <Stack spacing={1}>
                {publicCloudSorted.map((l, idx) => (
                  <Stack
                    key={l.id}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ py: 0.5 }}
                  >
                    <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>
                      {l.name}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label="Выше"
                      disabled={idx === 0}
                      onClick={() => void handleMovePublic(idx, -1)}
                    >
                      <KeyboardArrowUpRoundedIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label="Ниже"
                      disabled={idx === publicCloudSorted.length - 1}
                      onClick={() => void handleMovePublic(idx, 1)}
                    >
                      <KeyboardArrowDownRoundedIcon />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
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

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Удалить папку?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            «{deleteTarget?.name}» и все карточки в ней будут удалены
            {deleteTarget?.source === 'cloud' ? ' с сервера и с устройства' : ''}.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)}>Отмена</Button>
          <Button color="error" variant="contained" onClick={() => void handleDeleteFolder()}>
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!cardsLesson}
        onClose={() => setCardsLesson(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Карточки: {cardsLesson?.name}</DialogTitle>
        <DialogContent dividers>
          {cardsRows.length === 0 ? (
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
              Пока нет карточек.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {cardsRows.map((c) => (
                <Stack
                  key={c.id}
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {c.frontText}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {c.backText}
                    </Typography>
                  </Box>
                  <IconButton
                    aria-label="Удалить карточку"
                    color="error"
                    size="small"
                    onClick={() => void handleDeleteCardRow(c.id)}
                  >
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCardsLesson(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onClose={() => {
          setRenameTarget(null);
          setRenameError(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Название папки</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Название"
            value={renameValue}
            onChange={(e) => {
              setRenameValue(e.target.value);
              setRenameError(null);
            }}
            error={!!renameError}
            helperText={renameError}
            fullWidth
            margin="normal"
            inputProps={{ maxLength: LESSON_NAME_MAX_LENGTH }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setRenameTarget(null);
              setRenameError(null);
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={() => void handleSaveRename()}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
