import type { Card } from '../../db';

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Check user answer against correct backText.
 * Correct answer may contain variants separated by "/" (e.g. "красный/алый").
 * No fuzzy matching; exact match after normalize (trim + toLowerCase).
 */
export function checkAnswer(
  userAnswer: string,
  correctBackText: string
): { isCorrect: boolean } {
  const normalized = normalize(userAnswer);
  if (normalized === '') return { isCorrect: false };
  const variants = correctBackText
    .split('/')
    .map((v) => normalize(v))
    .filter((v) => v.length > 0);
  const isCorrect = variants.some((v) => v === normalized);
  return { isCorrect };
}

/**
 * Fisher–Yates shuffle. Mutates and returns the array.
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Build 4 (or fewer) shuffled options for multiple choice: 1 correct (current card backText)
 * + up to 3 wrong from other cards in the pool. No duplicates; graceful if pool is small.
 */
export function buildMultipleChoiceOptions(
  cards: Card[],
  currentIndex: number
): string[] {
  const correct = cards[currentIndex].backText;
  const wrongPool = new Set<string>();
  for (let i = 0; i < cards.length; i++) {
    if (i === currentIndex) continue;
    const back = cards[i].backText.trim();
    if (back && back !== correct) wrongPool.add(back);
  }
  const wrongArr = shuffle(Array.from(wrongPool));
  const wrongCount = Math.min(3, wrongArr.length);
  const options = [correct, ...wrongArr.slice(0, wrongCount)];
  return shuffle(options);
}

export type { Card };
