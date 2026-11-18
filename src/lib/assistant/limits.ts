// Sizes of the context sent with every question; api/chat.ts refuses bigger ones (the same numbers, a test pins them).
export const MAX_APP_CHARS = 20_000
export const MAX_LEARNER_CHARS = 6_000
export const MAX_PAGE_CHARS = 300
/** A question's length; api/chat.ts MAX_USER_CHARS is the same. */
export const MAX_QUESTION_CHARS = 500
