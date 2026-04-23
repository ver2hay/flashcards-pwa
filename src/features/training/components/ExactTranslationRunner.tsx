import { useEffect } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import type { Card } from '../../../db';

const AUTO_NEXT_MS = 1000;

interface ExactTranslationRunnerProps {
  currentCard: Card;
  position: number;
  total: number;
  score: number;
  currentAnswer: string;
  onAnswerChange: (value: string) => void;
  checked: boolean;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  onCheck: () => void;
  onDontKnow: () => void;
  onNext: () => void;
  /** Exit training and pick other cards */
  onAbort: () => void;
  checking: boolean;
}

export function ExactTranslationRunner({
  currentCard,
  position,
  total,
  score,
  currentAnswer,
  onAnswerChange,
  checked,
  userAnswer,
  isCorrect,
  correctAnswer,
  onCheck,
  onDontKnow,
  onNext,
  onAbort,
  checking,
}: ExactTranslationRunnerProps) {
  useEffect(() => {
    if (!checked || !isCorrect) return;
    const t = window.setTimeout(() => {
      onNext();
    }, AUTO_NEXT_MS);
    return () => window.clearTimeout(t);
  }, [checked, isCorrect, currentCard.id, onNext]);

  const showNext = checked && !isCorrect;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Карточка {position} / {total} · Очки: {score}
        </Typography>
        <Button size="small" variant="outlined" color="inherit" onClick={onAbort}>
          Прервать урок
        </Button>
      </Box>

      <Typography variant="h6" component="p" sx={{ mt: 2, mb: 2 }}>
        {currentCard.frontText}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Введите перевод (русский):
      </Typography>

      {!checked ? (
        <>
          <TextField
            value={currentAnswer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Ваш ответ"
            fullWidth
            autoFocus
            disabled={checking}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
            <Button
              variant="contained"
              onClick={onCheck}
              disabled={!currentAnswer.trim() || checking}
            >
              Проверить
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={onDontKnow}
              disabled={checking}
            >
              Я не знаю
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography
              component="span"
              sx={{
                color: isCorrect ? 'success.main' : 'error.main',
                fontWeight: 500,
              }}
            >
              Ваш ответ: {userAnswer}
            </Typography>
            {!isCorrect && (
              <Typography component="span" sx={{ color: 'success.main', ml: 1 }}>
                Верно: {correctAnswer}
              </Typography>
            )}
          </Box>
          {showNext && (
            <Button variant="contained" onClick={onNext} fullWidth>
              Далее
            </Button>
          )}
        </>
      )}
    </Box>
  );
}
