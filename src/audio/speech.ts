/**
 * Saying a scale degree out loud.
 *
 * The prompt cannot be one of the vocal samples: those sing the degree's name
 * ON its pitch, which is the answer. It cannot be a tone either, for the same
 * reason. So the phone says it — the built-in voice needs no assets, works
 * offline, and carries no pitch information at all.
 */

const DEGREE_WORDS: Record<string, string> = {
  '1': 'one',
  'b2': 'flat two',
  '2': 'two',
  'b3': 'flat three',
  '3': 'three',
  '4': 'four',
  '#4': 'sharp four',
  '5': 'five',
  'b6': 'flat six',
  '6': 'six',
  'b7': 'flat seven',
  '7': 'seven',
};

export function degreeInWords(degree: string): string {
  return DEGREE_WORDS[degree] ?? degree;
}

/** Whether this device can speak at all. The screen still shows the prompt. */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakDegree(degree: string) {
  if (!canSpeak()) return;
  try {
    // Drop anything still queued: a prompt from the previous round arriving
    // over this one would be worse than silence.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`sing ${degreeInWords(degree)}`);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // No voice available — the status text carries the prompt instead.
  }
}
