import type { Card } from '../../db';

export interface CheckedState {
  checked: boolean;
  userAnswer: string;
  isCorrect: boolean;
}

export interface TrainingModeOption {
  value: string;
  label: string;
  labelRu: string;
  disabled?: boolean;
  disabledReason?: string;
}

export const TRAINING_MODE_OPTIONS: TrainingModeOption[] = [
  { value: 'exact', label: 'Exact Translation', labelRu: 'Точный перевод' },
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    labelRu: 'Варианты ответов',
  },
];

export type { Card };
