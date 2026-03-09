import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  List,
  ListItem,
  ListItemText,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
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
  if (!trimmed) return 'Lesson name is required';
  if (trimmed.length > LESSON_NAME_MAX_LENGTH) {
    return `Max ${LESSON_NAME_MAX_LENGTH} characters`;
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
    console.log('[Lessons] loaded', lessonList.length);
    if (lessonList.length === 0) {
      console.warn('[Lessons] No lessons found in lessons table', {
        table: 'lessons',
        lessonCount: lessonList.length,
        cardCount: cards.length,
      });
    }
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
    ? 'Cloud unavailable while offline'
    : !isCloudApiConfigured
      ? 'Cloud API not configured'
      : null;
  const onlineHelperText = cloudDisabledReason
    ? cloudDisabledReason
    : createOnline
      ? 'This lesson will be uploaded to the cloud and available on other devices after sync.'
      : 'This lesson will stay only on this device.';

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
    const mode = createOnline ? 'cloud' : 'local';
    console.log('[Lesson Create] mode', mode);

    try {
      if (createOnline) {
        if (!cloudAvailable) {
          setCreateError(cloudDisabledReason ?? 'Cloud unavailable');
          return;
        }
        const payload = {
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const response = await createLessonCloud(payload);
        console.log('[Lesson Create] cloud response', response);
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
        console.log('[Lesson Create] dexie insert', response.id);
      } else {
        const lesson = await createLessonLocal({
          userId,
          name,
          source: 'local',
        });
        console.log('[Lesson Create] dexie insert', lesson.id);
      }
      handleCreateClose();
      await loadData();
      const refreshed = await getLessonsByUserId(userId);
      console.log('[Lesson Create] lessons refreshed', refreshed.length);
    } catch (error) {
      console.error('[Lesson Create] failed', error);
      setCreateError(
        'Failed to create cloud lesson. You can try again or save locally.'
      );
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Lessons
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Button variant="contained" onClick={handleCreateOpen}>
          Create lesson
        </Button>
        <Button
          variant="contained"
          startIcon={<SchoolIcon />}
          onClick={() => navigate('/train')}
          disabled={!hasLessons}
        >
          Start training
        </Button>
      </Box>

      {lessons.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4 }}>
          No lessons cached yet. Connect online to sync.
        </Typography>
      ) : (
        <List disablePadding>
          {lessons.map((lesson) => (
            <ListItem
              key={lesson.id}
              secondaryAction={
                <Chip
                  size="small"
                  label={lesson.source === 'local' ? 'Local' : 'Cloud'}
                  color={lesson.source === 'local' ? 'default' : 'success'}
                  variant="outlined"
                />
              }
              sx={{
                py: 1.5,
                px: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
                alignItems: 'center',
              }}
            >
              <ListItemText
                primary={lesson.name}
                secondary={
                  cardCountByLessonId[lesson.id] !== undefined
                    ? `${cardCountByLessonId[lesson.id]} card${cardCountByLessonId[lesson.id] === 1 ? '' : 's'}`
                    : undefined
                }
                primaryTypographyProps={{ variant: 'body1' }}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Dialog open={createOpen} onClose={handleCreateClose} fullWidth maxWidth="xs">
        <DialogTitle>Create lesson</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Lesson name"
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
              />
            }
            label="Online lesson"
          />
          <FormHelperText>{onlineHelperText}</FormHelperText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSubmit}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
