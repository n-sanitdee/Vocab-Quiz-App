/**
 * Web Speech Synthesis utility for native English pronunciation.
 * Allows accent selection (US/UK) and speed adjustments.
 */

export interface SpeechOptions {
  accent?: 'US' | 'UK';
  rate?: number; // 0.8 - 1.0
  onStart?: () => void;
  onEnd?: () => void;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(text: string, options: SpeechOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser environment.');
    options.onEnd?.();
    return;
  }

  // Cancel prior utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.accent === 'UK' ? 'en-GB' : 'en-US';
  utterance.rate = options.rate || 0.95;
  utterance.pitch = 1.0;

  // Try to find natural voices
  const voices = window.speechSynthesis.getVoices();
  const targetLang = options.accent === 'UK' ? 'en-GB' : 'en-US';
  const matchingVoice = voices.find(
    v => v.lang === targetLang || v.lang.replace('_', '-').startsWith(targetLang)
  ) || voices.find(v => v.lang.startsWith('en'));

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  if (options.onStart) utterance.onstart = options.onStart;
  if (options.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = () => options.onEnd?.();
  }

  window.speechSynthesis.speak(utterance);
}

export function speakDialogue(
  speakerA: string,
  speakerB: string,
  options: SpeechOptions = {}
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  options.onStart?.();

  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  const voiceA = enVoices[0] || null;
  const voiceB = enVoices[1] || voiceA;

  const utterA = new SpeechSynthesisUtterance(`Speaker A: ${speakerA}`);
  utterA.lang = options.accent === 'UK' ? 'en-GB' : 'en-US';
  utterA.rate = options.rate || 0.95;
  if (voiceA) utterA.voice = voiceA;

  const utterB = new SpeechSynthesisUtterance(`Speaker B: ${speakerB}`);
  utterB.lang = options.accent === 'UK' ? 'en-GB' : 'en-US';
  utterB.rate = options.rate || 0.95;
  utterB.pitch = 1.05; // slight pitch contrast
  if (voiceB) utterB.voice = voiceB;

  utterA.onend = () => {
    // Small pause before speaker B
    setTimeout(() => {
      window.speechSynthesis.speak(utterB);
    }, 280);
  };

  utterA.onerror = () => {
    window.speechSynthesis.speak(utterB);
  };

  utterB.onend = () => {
    options.onEnd?.();
  };
  utterB.onerror = () => {
    options.onEnd?.();
  };

  window.speechSynthesis.speak(utterA);
}
