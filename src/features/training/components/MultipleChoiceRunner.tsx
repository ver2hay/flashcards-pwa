import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { Card } from '../../../db';

interface OptionButtonProps {
  color: 'success' | 'error' | 'primary';
  variant: 'contained' | 'outlined';
  disabled: boolean;
  sx: { justifyContent: string; textTransform: string; '&.Mui-disabled'?: { opacity: number; backgroundColor?: string } };
}

const AUTO_NEXT_MS = 1000;

interface MultipleChoiceRunnerProps {
  currentCard: Card;
  position: number;
  total: number;
  score: number;
  options: string[];
  checked: boolean;
  userAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  onSelectOption: (option: string) => void;
  onDontKnow: () => void;
  onNext: () => void;
  onAbort: () => void;
  checking: boolean;
}

export function MultipleChoiceRunner({
  currentCard,
  position,
  total,
  score,
  options,
  correctAnswer,
  checked,
  userAnswer,
  isCorrect,
  onSelectOption,
  onDontKnow,
  onNext,
  onAbort,
  checking,
}: MultipleChoiceRunnerProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const displayOptions = useMemo(
    () => Array.from(new Set(options)),
    [options]
  );

  useEffect(() => {
    setSelectedOption(null);
    setIsRevealed(false);
  }, [currentCard.id]);

  useEffect(() => {
    if (!checked) return;
    setIsRevealed(true);
    if (userAnswer && displayOptions.includes(userAnswer)) {
      setSelectedOption(userAnswer);
    } else {
      setSelectedOption(null);
    }
  }, [checked, currentCard.id, userAnswer, displayOptions]);

  useEffect(() => {
    if (!checked || !isCorrect) return;
    const t = window.setTimeout(() => {
      onNext();
    }, AUTO_NEXT_MS);
    return () => window.clearTimeout(t);
  }, [checked, isCorrect, currentCard.id, onNext]);

  const getOptionButtonProps = useCallback(
    (option: string): OptionButtonProps => {
      const baseSx = {
        justifyContent: 'flex-start' as const,
        textTransform: 'none' as const,
      };
      const disabledSx = {
        '&.Mui-disabled': {
          opacity: 1,
        },
      };

      if (!isRevealed) {
        return {
          color: 'primary',
          variant: 'outlined',
          disabled: checking,
          sx: baseSx,
        };
      }

      const isCorrectOption = option === correctAnswer;
      const isSelectedWrong =
        option === selectedOption && selectedOption !== correctAnswer;

      if (isCorrectOption) {
        return {
          color: 'success',
          variant: 'contained',
          disabled: true,
          sx: {
            ...baseSx,
            ...disabledSx,
            '&.Mui-disabled': {
              ...disabledSx['&.Mui-disabled'],
              backgroundColor: 'success.main',
            },
          } as OptionButtonProps['sx'],
        };
      }
      if (isSelectedWrong) {
        return {
          color: 'error',
          variant: 'contained',
          disabled: true,
          sx: {
            ...baseSx,
            ...disabledSx,
            '&.Mui-disabled': {
              ...disabledSx['&.Mui-disabled'],
              backgroundColor: 'error.main',
            },
          } as OptionButtonProps['sx'],
        };
      }
      return {
        color: 'primary',
        variant: 'outlined',
        disabled: true,
        sx: { ...baseSx, ...disabledSx },
      };
    },
    [isRevealed, selectedOption, correctAnswer, checking]
  );

  const handleOptionClick = useCallback(
    (option: string) => {
      if (isRevealed || checking) return;
      setSelectedOption(option);
      setIsRevealed(true);
      onSelectOption(option);
    },
    [isRevealed, checking, onSelectOption]
  );

  const canUseDontKnow = !isRevealed && !checking;
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
          mb: 1,
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
        Выберите правильный перевод (русский):
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {displayOptions.map((option) => {
          const props = getOptionButtonProps(option);
          return (
            <Button
              key={option}
              variant={props.variant}
              color={props.color}
              disabled={props.disabled}
              onClick={() => handleOptionClick(option)}
              fullWidth
              sx={props.sx}
            >
              {option}
            </Button>
          );
        })}
        <Button
          variant="outlined"
          color="inherit"
          fullWidth
          disabled={!canUseDontKnow}
          onClick={onDontKnow}
          sx={{ justifyContent: 'center', textTransform: 'none' }}
        >
          Я не знаю
        </Button>
      </Box>

      {showNext && (
        <Button variant="contained" onClick={onNext} sx={{ mt: 2 }} fullWidth>
          Далее
        </Button>
      )}
    </Box>
  );
}
