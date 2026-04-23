import type { Card } from '../../db';

export interface CheckedState {
  checked: boolean;
  userAnswer: string;
  isCorrect: boolean;
}

export interface TrainingModeOption {
  value: string;
  /** Подпись для UI (только русский) */
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const TRAINING_MODE_OPTIONS: TrainingModeOption[] = [
  { value: 'exact', label: 'Точный перевод' },
  {
    value: 'multiple_choice',
    label: 'Варианты ответов',
  },
];

/** Сохраняется в ответе и в статистике при нажатии «Я не знаю». */
export const DONT_KNOW_USER_ANSWER = '(не знал)';

export type { Card };
