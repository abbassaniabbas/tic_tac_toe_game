import { DEFAULT_CONFIG, type GameConfig, type Score } from '@nexo/engine';
export type Preferences = { theme: 'dark' | 'light'; sound: boolean; haptics: boolean; reducedMotion: boolean };
export const DEFAULT_PREFERENCES: Preferences = { theme: 'dark', sound: false, haptics: false, reducedMotion: false };
const key = 'nexo-arena-v1';
export function loadSaved(): { preferences: Preferences; config: GameConfig; score: Score } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const config = raw.config;
    const validConfig = config && ['ai', 'local'].includes(config.mode) && ['easy','medium','hard'].includes(config.difficulty) && ['X','O'].includes(config.humanMark) && ['X','O'].includes(config.firstMark);
    const p = raw.preferences;
    const preferences = p && ['light','dark'].includes(p.theme) && ['sound','haptics','reducedMotion'].every(k => typeof p[k] === 'boolean') ? p : DEFAULT_PREFERENCES;
    const score = raw.score;
    const validScore = score && ['X','O','draws'].every(k => Number.isSafeInteger(score[k]) && score[k] >= 0);
    return { preferences, config: validConfig ? config : DEFAULT_CONFIG, score: validScore ? score : { X: 0, O: 0, draws: 0 } };
  } catch { return null; }
}
export function saveLocal(preferences: Preferences, config: GameConfig, score: Score) {
  try { localStorage.setItem(key, JSON.stringify({ preferences, config, score })); } catch { /* Private browsing can deny storage; play still works. */ }
}
let audio: AudioContext | undefined;
export function feedback(sound: boolean, haptics: boolean, celebration = false) {
  if (haptics && typeof navigator.vibrate === 'function') navigator.vibrate(celebration ? [20, 40, 20] : 12);
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const note = (frequency: number, delay: number) => {
      const oscillator = audio!.createOscillator(); const gain = audio!.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audio!.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audio!.currentTime + delay + 0.15);
      oscillator.connect(gain); gain.connect(audio!.destination);
      oscillator.start(audio!.currentTime + delay); oscillator.stop(audio!.currentTime + delay + 0.16);
    };
    note(celebration ? 523 : 440, 0); if (celebration) { note(659, 0.1); note(784, 0.2); }
  } catch { /* Feedback is optional on unsupported browsers. */ }
}
