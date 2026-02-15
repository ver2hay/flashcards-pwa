import { Box, Button, TextField, Typography } from '@mui/material';
import type { Card } from '../../../db';

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
  onNext: () => void;
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
  onNext,
  checking,
}: ExactTranslationRunnerProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Card {position} / {total} · Score: {score}
      </Typography>

      <Typography variant="h6" component="p" sx={{ mt: 2, mb: 2 }}>
        {currentCard.frontText}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Type the translation (Russian):
      </Typography>

      {!checked ? (
        <>
          <TextField
            value={currentAnswer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Your answer"
            fullWidth
            autoFocus
            disabled={checking}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              onClick={onCheck}
              disabled={!currentAnswer.trim() || checking}
            >
              Check
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
              Your answer: {userAnswer}
            </Typography>
            {!isCorrect && (
              <Typography component="span" sx={{ color: 'success.main', ml: 1 }}>
                Correct: {correctAnswer}
              </Typography>
            )}
          </Box>
          <Button variant="contained" onClick={onNext}>
            Next
          </Button>
        </>
      )}
    </Box>
  );
}
