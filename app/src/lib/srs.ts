import { createEmptyCard, fsrs, generatorParameters, Rating, State, TypeConvert, type Card, type Grade as FsrsGrade } from 'ts-fsrs';
import type { CardRecord, Grade } from './types';

const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 120,
    enable_fuzz: true,
    // Richtig beim ersten Mal gilt sofort als gelernt. Falsch kommt nach etwa einer Minute wieder.
    learning_steps: ['1m'],
    relearning_steps: ['5m'],
  }),
);

const GRADE_MAP: Record<Grade, FsrsGrade> = { 1: Rating.Again, 2: Rating.Hard, 3: Rating.Good };

export function newRecord(now: Date): CardRecord {
  return { card: JSON.parse(JSON.stringify(createEmptyCard(now))), firstSeen: now.getTime(), reviews: 0, lapses: 0 };
}

export function cardOf(rec: CardRecord): Card {
  return TypeConvert.card(rec.card as never);
}

/** Wendet eine Antwort an und gibt den neuen Kartenstand zurück. */
export function applyReview(rec: CardRecord | undefined, grade: Grade, now: Date): CardRecord {
  const base = rec ?? newRecord(now);
  const result = scheduler.next(cardOf(base), now, GRADE_MAP[grade]);
  return {
    card: JSON.parse(JSON.stringify(result.card)),
    firstSeen: base.firstSeen,
    reviews: base.reviews + 1,
    lapses: base.lapses + (grade === 1 ? 1 : 0),
  };
}

/** Wie sicher sitzt die Karte jetzt (0 bis 1)? Nach FSRS-Gedächtnismodell, für die Reihenfolge nach einer Pause. */
export function retrievability(rec: CardRecord, now: Date): number {
  return scheduler.get_retrievability(cardOf(rec), now, false);
}

export function dueDate(rec: CardRecord): Date {
  return cardOf(rec).due;
}

export function cardState(rec: CardRecord): State {
  return cardOf(rec).state;
}

export function stability(rec: CardRecord): number {
  return cardOf(rec).stability;
}

export { State };
