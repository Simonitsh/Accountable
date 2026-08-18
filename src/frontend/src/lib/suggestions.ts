/**
 * Category-aware suggestion library.
 *
 * SUGGESTIONS is keyed by [category][field] and returns exactly 5 short,
 * actionable suggestion strings tailored to the field's intent and the
 * category. Categories use the exact string ids from CATEGORY_DETAILS
 * ("Health" | "Learning" | "Social" | "Productivity" | "Leisure").
 *
 * Field intents:
 *  - goalAction:     the concrete action the user wants to take
 *  - goalReason:     the deeper motivation / feeling behind the goal
 *  - habitAction:    the daily habit verb that moves the goal forward
 *  - habitMinutes:   numeric duration strings for the daily habit
 *  - ifThenPlan:     an "if [obstacle], then I will…" contingency
 *  - wish:           the high-level wish statement
 *  - wishDescription: the specific daily behavior description
 */

export type SuggestionField =
  | "goalAction"
  | "goalReason"
  | "habitAction"
  | "habitMinutes"
  | "ifThenPlan"
  | "wish"
  | "wishDescription";

export const SUGGESTIONS: Record<
  string,
  Partial<Record<SuggestionField, string[]>>
> = {
  Health: {
    goalAction: [
      "run a 5K without stopping",
      "drink 8 glasses of water daily",
      "sleep 8 hours every night",
      "eat a vegetable with every meal",
      "walk 10,000 steps a day",
    ],
    goalReason: [
      "feel energized and strong",
      "stay healthy for my family",
      "build lifelong resilience",
      "move without pain or fatigue",
      "feel proud of my body",
    ],
    habitAction: ["run", "walk", "stretch", "meditate", "hydrate"],
    habitMinutes: ["15", "30", "45", "60", "20"],
    ifThenPlan: [
      "if I feel tired, then I will do a 10-minute stretch routine instead",
      "if it rains, then I will do a home workout video indoors",
      "if I skip morning, then I will walk after dinner instead",
      "if I crave junk food, then I will eat a piece of fruit first",
      "if I feel sore, then I will take a gentle yoga session instead",
    ],
    wish: [
      "i want to run a 5K so that I can feel unstoppable",
      "i want to sleep deeply so that I can wake up refreshed",
      "i want to eat well so that I can think clearly",
      "i want to move daily so that I can stay strong for decades",
      "i want to hydrate well so that I can feel energized all day",
    ],
    wishDescription: [
      "every day, I will run for 30 minutes before breakfast",
      "every day, I will drink a glass of water with each meal",
      "every night, I will wind down screens 60 minutes before bed",
      "every meal, I will fill half my plate with vegetables",
      "every evening, I will take a 20-minute walk after dinner",
    ],
  },

  Learning: {
    goalAction: [
      "read 12 books this year",
      "finish a Spanish course",
      "learn to code in Python",
      "master public speaking",
      "pass a professional certification",
    ],
    goalReason: [
      "grow intellectually every week",
      "open new career opportunities",
      "stay curious and adaptable",
      "build expertise I can share",
      "feel confident in conversations",
    ],
    habitAction: ["read", "study", "practice", "review", "write"],
    habitMinutes: ["15", "30", "45", "60", "25"],
    ifThenPlan: [
      "if I feel unfocused, then I will study in 25-minute Pomodoro blocks",
      "if I miss a session, then I will review for 10 minutes instead",
      "if I feel stuck, then I will summarize what I learned so far",
      "if I lose motivation, then I will revisit my end goal for 5 minutes",
      "if I get distracted, then I will move to a quieter space and restart",
    ],
    wish: [
      "i want to read 12 books so that I can think more deeply",
      "i want to learn Spanish so that I can travel with confidence",
      "i want to learn Python so that I can build my own tools",
      "i want to speak well so that I can lead with presence",
      "i want to get certified so that I can advance my career",
    ],
    wishDescription: [
      "every day, I will read for 30 minutes before bed",
      "every day, I will study Spanish for 20 minutes on my commute",
      "every day, I will code for 45 minutes after work",
      "every day, I will practice speaking for 15 minutes aloud",
      "every day, I will review flashcards for 25 minutes",
    ],
  },

  Social: {
    goalAction: [
      "reconnect with an old friend weekly",
      "attend one community event monthly",
      "call family every Sunday",
      "host a dinner once a month",
      "join a local club or group",
    ],
    goalReason: [
      "feel deeply connected to others",
      "build a support network I can lean on",
      "strengthen relationships that matter",
      "belong to a community that lifts me",
      "show up for the people I love",
    ],
    habitAction: ["call", "message", "visit", "invite", "thank"],
    habitMinutes: ["5", "10", "15", "20", "30"],
    ifThenPlan: [
      "if I feel too busy, then I will send a short voice message instead",
      "if I feel awkward, then I will invite one person for coffee",
      "if I miss a call, then I will reschedule within two days",
      "if I feel isolated, then I will attend one event this week",
      "if I forget, then I will set a recurring reminder on my phone",
    ],
    wish: [
      "i want to reconnect with friends so that I can feel close again",
      "i want to attend events so that I can build community",
      "i want to call family weekly so that I can stay bonded",
      "i want to host dinners so that I can deepen friendships",
      "i want to join a club so that I can belong somewhere",
    ],
    wishDescription: [
      "every week, I will call one friend for 15 minutes on Sunday",
      "every month, I will attend one community event near me",
      "every Sunday, I will call family for 30 minutes",
      "every month, I will host a dinner for three friends",
      "every week, I will message one person I have not spoken to in a while",
    ],
  },

  Productivity: {
    goalAction: [
      "inbox zero every Friday",
      "ship one side project this quarter",
      "build a daily planning habit",
      "cut meeting time by 25%",
      "launch a personal website",
    ],
    goalReason: [
      "create space for deep work",
      "feel in control of my time",
      "make visible progress on what matters",
      "reduce overwhelm and burnout",
      "build momentum toward bigger goals",
    ],
    habitAction: ["plan", "focus", "review", "ship", "declutter"],
    habitMinutes: ["15", "25", "30", "45", "60"],
    ifThenPlan: [
      "if I feel scattered, then I will write a 3-task priority list first",
      "if a meeting runs long, then I will leave at the scheduled end time",
      "if I get distracted, then I will close all tabs and restart the timer",
      "if I feel overwhelmed, then I will pick the single next smallest step",
      "if I miss a planning session, then I will plan for 5 minutes before bed",
    ],
    wish: [
      "i want to reach inbox zero so that I can feel clear-headed",
      "i want to ship a project so that I can prove I can finish",
      "i want to plan daily so that I can focus on what matters",
      "i want to cut meetings so that I can reclaim my time",
      "i want to launch a site so that I can showcase my work",
    ],
    wishDescription: [
      "every Friday, I will clear my inbox for 30 minutes",
      "every day, I will plan my top 3 tasks for 10 minutes",
      "every morning, I will do 60 minutes of deep work before email",
      "every week, I will review my calendar and cut one meeting",
      "every day, I will ship one small improvement for 25 minutes",
    ],
  },

  Leisure: {
    goalAction: [
      "paint one artwork a month",
      "play guitar 3 times a week",
      "hike a new trail monthly",
      "cook a new recipe weekly",
      "finish a craft project",
    ],
    goalReason: [
      "recharge and feel creatively alive",
      "make space for pure enjoyment",
      "rediscover play and curiosity",
      "feel balanced and refreshed",
      "create something I am proud of",
    ],
    habitAction: ["paint", "play", "hike", "cook", "craft"],
    habitMinutes: ["15", "30", "45", "60", "20"],
    ifThenPlan: [
      "if I feel uninspired, then I will spend 10 minutes gathering ideas first",
      "if I run out of time, then I will do a 15-minute mini session instead",
      "if I feel tired, then I will listen to music and doodle casually",
      "if I miss a session, then I will reschedule it within the same week",
      "if I feel stuck, then I will switch to a simpler project for the day",
    ],
    wish: [
      "i want to paint monthly so that I can feel creatively alive",
      "i want to play guitar so that I can enjoy making music",
      "i want to hike trails so that I can feel refreshed by nature",
      "i want to cook new dishes so that I can savor my evenings",
      "i want to finish a craft so that I can make something with my hands",
    ],
    wishDescription: [
      "every week, I will paint for 45 minutes on Saturday morning",
      "every week, I will play guitar for 30 minutes three evenings",
      "every month, I will hike one new trail on a weekend",
      "every week, I will cook one new recipe on Sunday",
      "every week, I will craft for 30 minutes on a free evening",
    ],
  },
};

/**
 * Returns the 5 suggestions for a (category, field) pair, or an empty array
 * if the category or field has no suggestions defined.
 */
export function getSuggestions(
  category: string,
  field: SuggestionField,
): string[] {
  return SUGGESTIONS[category]?.[field] ?? [];
}
