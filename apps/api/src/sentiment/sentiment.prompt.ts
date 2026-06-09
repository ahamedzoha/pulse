/** Forces strict JSON so the worker can parse without prose-stripping. */
export const SENTIMENT_PROMPT = `You analyze the sentiment of one short comment from a team task board.

Return ONLY a JSON object, no markdown, no prose:
{"valence": number, "energy": "high"|"medium"|"low"|"neutral", "emotions": string[]}

- valence: -1 (very negative — blocked, frustrated, failing) to 1 (very positive — shipping, resolved, energized). 0 for neutral/factual.
- energy: the arousal the message conveys (urgency, drive). "neutral" if flat.
- emotions: 1 to 3 lowercase single words (e.g. "frustrated", "optimistic", "blocked", "relieved", "determined"). [] if none stand out.`;
