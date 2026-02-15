import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SchoolIcon from '@mui/icons-material/School';
import {
  getSessionById,
  getAnswersBySessionId,
  getCardById,
  type TrainingSession,
} from '../db';

interface MistakeRow {
  frontText: string;
  correctBackText: string;
  userAnswer: string;
}

const MODE_LABELS: Record<string, string> = {
  exact: 'Exact Translation (Точный перевод)',
  multiple_choice: 'Multiple Choice (Варианты ответов)',
  learn: 'Learn',
  review: 'Review',
  test: 'Test',
};

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [mistakes, setMistakes] = useState<MistakeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadResults = useCallback(async () => {
    if (!sessionId) return;
    const [sess, answers] = await Promise.all([
      getSessionById(sessionId),
      getAnswersBySessionId(sessionId),
    ]);
    setSession(sess ?? null);
    const wrongAnswers = answers.filter((a) => !a.isCorrect);
    const cards = await Promise.all(
      wrongAnswers.map((a) => getCardById(a.cardId))
    );
    const rows: MistakeRow[] = wrongAnswers
      .map((a, i) => {
        const card = cards[i];
        if (!card) return null;
        return {
          frontText: card.frontText,
          correctBackText: card.backText,
          userAnswer: a.userAnswer,
        };
      })
      .filter((r): r is MistakeRow => r !== null);
    setMistakes(rows);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  if (loading || !session) {
    return (
      <Box>
        <Typography variant="h5" component="h1" gutterBottom>
          Results
        </Typography>
        <Typography color="text.secondary">
          {loading ? 'Loading…' : 'Session not found.'}
        </Typography>
      </Box>
    );
  }

  const total = session.score !== null ? mistakes.length + session.score : 0;
  const correctCount = session.score ?? 0;
  const dateStr = new Date(session.startedAt).toLocaleString();

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Results
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ width: { xs: '100%', md: '33.333%' } }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6">Summary</Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                <strong>Score:</strong> {correctCount} / {total}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Mode: {MODE_LABELS[session.mode] ?? session.mode}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Date: {dateStr}
              </Typography>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<FolderIcon />}
                  onClick={() => navigate('/folders')}
                  sx={{ width: { xs: '100%', md: 'auto' } }}
                >
                  Go to folders
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SchoolIcon />}
                  onClick={() => navigate('/train')}
                  sx={{ width: { xs: '100%', md: 'auto' } }}
                >
                  Start training
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ width: { xs: '100%', md: '66.666%' } }}>
          {mistakes.length > 0 ? (
            <>
              <Typography variant="h6" sx={{ mt: { xs: 2, md: 0 }, mb: 1 }}>
                Mistakes
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Kazakh (prompt)</TableCell>
                      <TableCell>Correct (Russian)</TableCell>
                      <TableCell>Your answer</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {mistakes.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.frontText}</TableCell>
                        <TableCell sx={{ color: 'success.main' }}>
                          {row.correctBackText}
                        </TableCell>
                        <TableCell sx={{ color: 'error.main' }}>
                          {row.userAnswer}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <Typography color="text.secondary">No mistakes — great job!</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
