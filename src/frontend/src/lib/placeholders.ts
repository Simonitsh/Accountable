/**
 * Category-aware placeholder library.
 *
 * getPlaceholder(category, field) returns a short, greyed-out example string
 * shown inside inputs to hint at the expected content. These are distinct from
 * the 5 actionable suggestions in suggestions.ts — placeholders are passive
 * hints, suggestions are tappable shortcuts.
 *
 * Categories use the exact string ids from CATEGORY_DETAILS
 * ("Health" | "Learning" | "Social" | "Productivity" | "Leisure").
 */

import type { SuggestionField } from "./suggestions";

const PLACEHOLDERS: Record<string, Partial<Record<SuggestionField, string>>> = {
  Health: {
    goalAction: "run a 5K without stopping",
    goalReason: "feel energized and strong",
    habitAction: "run",
    habitMinutes: "30",
    ifThenPlan: "If I feel tired, then I will do a 10-min stretch instead",
    wish: "I want to run a 5K so that I can feel unstoppable",
    wishDescription: "Every day, I will run for 30 minutes before breakfast",
  },
  Learning: {
    goalAction: "read 12 books this year",
    goalReason: "grow intellectually every week",
    habitAction: "read",
    habitMinutes: "30",
    ifThenPlan:
      "If I feel unfocused, then I will study in 25-min Pomodoro blocks",
    wish: "I want to read 12 books so that I can think more deeply",
    wishDescription: "Every day, I will read for 30 minutes before bed",
  },
  Social: {
    goalAction: "reconnect with an old friend weekly",
    goalReason: "feel deeply connected to others",
    habitAction: "call",
    habitMinutes: "15",
    ifThenPlan:
      "If I feel too busy, then I will send a short voice message instead",
    wish: "I want to reconnect with friends so that I can feel close again",
    wishDescription:
      "Every week, I will call one friend for 15 minutes on Sunday",
  },
  Productivity: {
    goalAction: "reach inbox zero every Friday",
    goalReason: "create space for deep work",
    habitAction: "plan",
    habitMinutes: "25",
    ifThenPlan:
      "If I feel scattered, then I will write a 3-task priority list first",
    wish: "I want to reach inbox zero so that I can feel clear-headed",
    wishDescription: "Every Friday, I will clear my inbox for 30 minutes",
  },
  Leisure: {
    goalAction: "paint one artwork a month",
    goalReason: "recharge and feel creatively alive",
    habitAction: "paint",
    habitMinutes: "45",
    ifThenPlan:
      "If I feel uninspired, then I will spend 10 min gathering ideas first",
    wish: "I want to paint monthly so that I can feel creatively alive",
    wishDescription:
      "Every week, I will paint for 45 minutes on Saturday morning",
  },
};

/**
 * Returns a category-relevant placeholder example string for the given
 * (category, field) pair. Falls back to a neutral generic placeholder if the
 * category or field is not explicitly covered.
 */
export function getPlaceholder(
  category: string,
  field: SuggestionField,
): string {
  return PLACEHOLDERS[category]?.[field] ?? FALLBACK_PLACEHOLDERS[field];
}

const FALLBACK_PLACEHOLDERS: Record<SuggestionField, string> = {
  goalAction: "describe the action you want to take",
  goalReason: "describe the feeling you are after",
  habitAction: "the daily verb",
  habitMinutes: "30",
  ifThenPlan: "If [obstacle], then I will…",
  wish: "I want to … so that I can …",
  wishDescription: "Every day, I will …",
};
