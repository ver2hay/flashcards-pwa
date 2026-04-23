import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import { TRAINING_MODE_OPTIONS } from '../types';
import type { Lesson } from '../../../db';
import Checkbox from '@mui/material/Checkbox';

interface TrainSetupProps {
  lessons: Lesson[];
  selectedLessonIds: string[];
  onLessonToggle: (lessonId: string) => void;
  mode: string;
  onModeChange: (mode: string) => void;
  onStart: () => void;
  canStart: boolean;
  noCardsMessage: string | null;
}

export function TrainSetup({
  lessons,
  selectedLessonIds,
  onLessonToggle,
  mode,
  onModeChange,
  onStart,
  canStart,
  noCardsMessage,
}: TrainSetupProps) {
  return (
    <Box>
      <Typography variant="h5" component="h1" gutterBottom>
        Настройка тренировки
      </Typography>

      <FormControl component="fieldset" sx={{ mt: 2, mb: 2 }} fullWidth>
        <FormLabel component="legend">Папки</FormLabel>
        <FormGroup>
          {lessons.map((lesson) => (
            <FormControlLabel
              key={lesson.id}
              control={
                <Checkbox
                  checked={selectedLessonIds.includes(lesson.id)}
                  onChange={() => onLessonToggle(lesson.id)}
                />
              }
              label={lesson.name}
            />
          ))}
        </FormGroup>
      </FormControl>

      <FormControl component="fieldset" sx={{ mt: 2, mb: 2 }} fullWidth>
        <FormLabel component="legend">Режим</FormLabel>
        <RadioGroup
          value={mode}
          onChange={(e) => onModeChange(e.target.value)}
          name="mode"
        >
          {TRAINING_MODE_OPTIONS.map((opt) => (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={<Radio disabled={opt.disabled} />}
              label={
                <Box component="span">
                  {opt.label}
                  {opt.disabledReason != null && (
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      sx={{ ml: 0.5 }}
                    >
                      — {opt.disabledReason}
                    </Typography>
                  )}
                </Box>
              }
              disabled={opt.disabled}
            />
          ))}
        </RadioGroup>
      </FormControl>

      {noCardsMessage && (
        <Typography color="error" sx={{ mb: 2 }}>
          {noCardsMessage}
        </Typography>
      )}

      <Button
        variant="contained"
        onClick={onStart}
        disabled={!canStart}
        fullWidth
      >
        Начать тренировку
      </Button>
    </Box>
  );
}
