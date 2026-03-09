import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import {
  getLessonsByUserId,
  getCardsByLessonId,
  createSession,
  updateSession,
} from '../db';
import { useTrainingStore } from '../features/training/trainingStore';
import { shuffle, buildMultipleChoiceOptions } from '../features/training/engine';
import {
  TrainSetup,
  ExactTranslationRunner,
  MultipleChoiceRunner,
} from '../features/training';
import type { TrainingMode } from '../db';

export function TrainPage() {
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Awaited<ReturnType<typeof getLessonsByUserId>>>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [mode, setMode] = useState<string>('exact');
  const [noCardsMessage, setNoCardsMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const {
    sessionId,
    mode: storeMode,
    cards,
    currentIndex,
    score,
    checkedMap,
    currentAnswer,
    currentOptions,
    startTraining,
    setCurrentAnswer,
    setCurrentOptions,
    checkAnswer,
    nextCard,
    reset,
  } = useTrainingStore();

  const loadLessons = useCallback(async () => {
    if (!userId) return;
    const list = await getLessonsByUserId(userId);
    setLessons(list);
  }, [userId]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const isRunnerActive = sessionId !== null && cards.length > 0;
  const showRunner = isRunnerActive && currentIndex < cards.length;
  const currentCard = showRunner ? cards[currentIndex] : null;
  const checkedState = currentCard ? checkedMap[currentCard.id] : null;

  const handleLessonToggle = (lessonId: string) => {
    setSelectedLessonIds((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
    setNoCardsMessage(null);
  };

  const handleStart = async () => {
    if (!userId || selectedLessonIds.length === 0) return;
    setNoCardsMessage(null);
    const allCards: Awaited<ReturnType<typeof getCardsByLessonId>> = [];
    for (const lessonId of selectedLessonIds) {
      const list = await getCardsByLessonId(lessonId);
      allCards.push(...list.filter((c) => c.userId === userId));
    }
    if (allCards.length === 0) {
      setNoCardsMessage('No cards in selected lessons.');
      return;
    }
    const shuffled = shuffle([...allCards]);
    const modeToUse: TrainingMode =
      mode === 'multiple_choice' ? 'multiple_choice' : 'exact';
    const session = await createSession({
      userId,
      mode: modeToUse,
    });
    startTraining(session.id, modeToUse, selectedLessonIds, shuffled);
    if (modeToUse === 'multiple_choice') {
      setCurrentOptions(buildMultipleChoiceOptions(shuffled, 0));
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      await checkAnswer();
    } finally {
      setChecking(false);
    }
  };

  const handleSelectOption = async (option: string) => {
    setChecking(true);
    try {
      await checkAnswer(option);
    } finally {
      setChecking(false);
    }
  };

  const handleNext = async () => {
    const { done } = nextCard();
    if (done && sessionId) {
      const finalScore = useTrainingStore.getState().score;
      await updateSession(sessionId, {
        finishedAt: Date.now(),
        score: finalScore,
      });
      navigate(`/results/${sessionId}`, { replace: true });
    } else if (storeMode === 'multiple_choice') {
      const state = useTrainingStore.getState();
      setCurrentOptions(
        buildMultipleChoiceOptions(state.cards, state.currentIndex)
      );
    }
  };

  useEffect(() => {
    if (!showRunner && !isRunnerActive) {
      reset();
    }
    if (sessionId && cards.length > 0 && currentIndex >= cards.length) {
      reset();
    }
  }, [showRunner, isRunnerActive, sessionId, cards.length, currentIndex, reset]);

  if (isRunnerActive && showRunner && currentCard) {
    if (storeMode === 'multiple_choice') {
      return (
        <MultipleChoiceRunner
          currentCard={currentCard}
          position={currentIndex + 1}
          total={cards.length}
          score={score}
          options={currentOptions}
          checked={checkedState?.checked ?? false}
          userAnswer={checkedState?.userAnswer ?? ''}
          isCorrect={checkedState?.isCorrect ?? false}
          correctAnswer={currentCard.backText}
          onSelectOption={handleSelectOption}
          onNext={handleNext}
          checking={checking}
        />
      );
    }
    return (
      <ExactTranslationRunner
        currentCard={currentCard}
        position={currentIndex + 1}
        total={cards.length}
        score={score}
        currentAnswer={currentAnswer}
        onAnswerChange={setCurrentAnswer}
        checked={checkedState?.checked ?? false}
        userAnswer={checkedState?.userAnswer ?? ''}
        isCorrect={checkedState?.isCorrect ?? false}
        correctAnswer={currentCard.backText}
        onCheck={handleCheck}
        onNext={handleNext}
        checking={checking}
      />
    );
  }

  return (
    <TrainSetup
      lessons={lessons}
      selectedLessonIds={selectedLessonIds}
      onLessonToggle={handleLessonToggle}
      mode={mode}
      onModeChange={setMode}
      onStart={handleStart}
      canStart={selectedLessonIds.length >= 1}
      noCardsMessage={noCardsMessage}
    />
  );
}
