import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useAuthStore } from '../features/auth/authStore';
import { getSessionsByUserId, getAnswersBySessionId, type TrainingSession } from '../db';

const MODE_LABELS: Record<string, string> = {
  exact: 'Точный перевод',
  multiple_choice: 'Варианты ответов',
  learn: 'Учёба',
  review: 'Повтор',
  test: 'Тест',
};

interface SessionRow {
  session: TrainingSession;
  total: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function ResultsListPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!userId) return;
    const sessions = await getSessionsByUserId(userId);
    const totals = await Promise.all(
      sessions.map((s) => getAnswersBySessionId(s.id).then((a) => a.length))
    );
    setRows(
      sessions.map((session, i) => ({ session, total: totals[i] ?? 0 }))
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRowClick = (sessionId: string) => {
    navigate(`/results/${sessionId}`);
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" component="h1" gutterBottom>
          История тренировок
        </Typography>
        <Typography color="text.secondary">Загрузка…</Typography>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box>
        <Typography variant="h5" component="h1" gutterBottom>
          История тренировок
        </Typography>
        <Typography color="text.secondary">
          Пока нет завершённых тренировок. Завершите урок — здесь появятся результаты.
        </Typography>
      </Box>
    );
  }

  if (isMobile) {
    return (
      <Box>
        <Typography variant="h5" component="h1" gutterBottom>
          История тренировок
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {rows.map(({ session, total }) => {
            const correct = session.score ?? 0;
            return (
              <Card key={session.id} variant="outlined">
                <CardActionArea onClick={() => handleRowClick(session.id)}>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary">
                      {formatDate(session.startedAt)}
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>
                      {MODE_LABELS[session.mode] ?? session.mode}
                    </Typography>
                    <Typography variant="body2">
                      Очки: {correct} / {total}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        История тренировок
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="medium" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Дата</TableCell>
              <TableCell>Режим</TableCell>
              <TableCell align="right">Очки</TableCell>
              <TableCell align="right">Всего</TableCell>
              <TableCell align="right">Верно</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(({ session, total }) => {
              const correct = session.score ?? 0;
              return (
                <TableRow
                  key={session.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(session.id)}
                >
                  <TableCell>{formatDate(session.startedAt)}</TableCell>
                  <TableCell>
                    {MODE_LABELS[session.mode] ?? session.mode}
                  </TableCell>
                  <TableCell align="right">
                    {correct} / {total}
                  </TableCell>
                  <TableCell align="right">{total}</TableCell>
                  <TableCell align="right">{correct}</TableCell>
                  <TableCell>
                    <Typography variant="body2" color="primary">
                      Подробнее
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
