import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, List, ListItem, ListItemText, Typography } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useAuthStore } from '../features/auth/authStore';
import { getLessonsByUserId, getCardsByUserId, type Lesson } from '../db';

export function FoldersPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [cardCountByLessonId, setCardCountByLessonId] = useState<Record<string, number>>({});

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

  const hasLessons = lessons.length > 0;

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Lessons
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
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
    </Box>
  );
}
