import { create } from 'zustand';
import type { Card } from '../../db';
import type { TrainingMode } from '../../db';
import { createAnswer, updateSession } from '../../db';
import { checkAnswer as checkAnswerEngine } from './engine';
import type { CheckedState } from './types';

interface TrainingState {
  sessionId: string | null;
  mode: TrainingMode;
  folderIds: string[];
  cards: Card[];
  currentIndex: number;
  score: number;
  checkedMap: Record<string, CheckedState>;
  currentAnswer: string;
  /** Options for current card (multiple choice only); set by page when card changes */
  currentOptions: string[];

  startTraining: (
    sessionId: string,
    mode: TrainingMode,
    folderIds: string[],
    cards: Card[]
  ) => void;
  setCurrentAnswer: (text: string) => void;
  setCurrentOptions: (options: string[]) => void;
  checkAnswer: (selectedAnswer?: string) => Promise<void>;
  nextCard: () => { done: boolean };
  reset: () => void;
}

const initialState = {
  sessionId: null as string | null,
  mode: 'exact' as TrainingMode,
  folderIds: [] as string[],
  cards: [] as Card[],
  currentIndex: 0,
  score: 0,
  checkedMap: {} as Record<string, CheckedState>,
  currentAnswer: '',
  currentOptions: [],
};

export const useTrainingStore = create<TrainingState>((set, get) => ({
  ...initialState,

  startTraining: (
    sessionId: string,
    mode: TrainingMode,
    folderIds: string[],
    cards: Card[]
  ) => {
    set({
      sessionId,
      mode,
      folderIds,
      cards,
      currentIndex: 0,
      score: 0,
      checkedMap: {},
      currentAnswer: '',
      currentOptions: [],
    });
  },

  setCurrentAnswer: (text: string) => {
    set({ currentAnswer: text });
  },

  setCurrentOptions: (options: string[]) => {
    set({ currentOptions: options });
  },

  checkAnswer: async (selectedAnswer?: string) => {
    const { sessionId, cards, currentIndex, currentAnswer, checkedMap, score, mode } =
      get();
    if (!sessionId || currentIndex >= cards.length) return;
    const card = cards[currentIndex];
    const answerToUse = selectedAnswer ?? currentAnswer;
    const isCorrect =
      mode === 'multiple_choice'
        ? answerToUse === card.backText
        : checkAnswerEngine(answerToUse, card.backText).isCorrect;
    const newScore = score + (isCorrect ? 1 : 0);
    const newChecked: CheckedState = {
      checked: true,
      userAnswer: answerToUse,
      isCorrect,
    };

    await createAnswer({
      sessionId,
      cardId: card.id,
      userAnswer: answerToUse,
      isCorrect,
    });
    await updateSession(sessionId, { score: newScore });

    set({
      checkedMap: { ...checkedMap, [card.id]: newChecked },
      score: newScore,
      currentAnswer: '',
    });
  },

  nextCard: () => {
    const { cards, currentIndex } = get();
    const nextIndex = currentIndex + 1;
    set({ currentIndex: nextIndex });
    return { done: nextIndex >= cards.length };
  },

  reset: () => {
    set(initialState);
  },
}));
