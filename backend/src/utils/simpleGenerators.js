function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickKeywords(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 5 && !/^\d+$/.test(t));

  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateFlashcardsFromText({ text, maxCards = 12 }) {
  const sentences = splitSentences(text).slice(0, maxCards);
  const cards = sentences.map((s) => {
    const words = s.split(' ');
    const front = words.length > 10 ? `${words.slice(0, 10).join(' ')}…?` : `${s}?`;
    return { front: `Explain: ${front}`, back: s };
  });
  return cards.length ? cards : [{ front: 'Summarize the topic', back: text.trim().slice(0, 200) }];
}

export function generateQuizFromText({ text, numQuestions = 8 }) {
  const sentences = splitSentences(text);
  const keywords = pickKeywords(text);
  const chosenSentences = shuffle(sentences).slice(0, Math.min(numQuestions, sentences.length));

  const questions = chosenSentences.map((s) => {
    const sentenceKeywords = keywords.filter((k) => s.toLowerCase().includes(k));
    const answer = sentenceKeywords[0] || s.split(' ').find((w) => w.length >= 6) || 'concept';
    const prompt = s.replace(new RegExp(`\\b${answer}\\b`, 'i'), '_____');
    const distractors = shuffle(keywords.filter((k) => k !== answer)).slice(0, 3);
    const options = shuffle([answer, ...distractors]).slice(0, 4);
    const correctOptionIndex = options.findIndex((o) => o === answer);
    return { prompt: `Fill in the blank: ${prompt}`, options, correctOptionIndex: Math.max(0, correctOptionIndex) };
  });

  return questions.filter((q) => q.options.length >= 2);
}

