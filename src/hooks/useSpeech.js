import { useCallback, useEffect, useRef, useState } from 'react';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
let primed = false;
const listeners = new Set();

// Must be called from a user gesture at least once (iOS/Chrome autoplay rules).
export function primeSpeech() {
  if (!supported) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* ignore */ }
  primed = true;
  listeners.forEach((l) => l(true));
}

export function useSpeech() {
  const [ready, setReady] = useState(primed);
  const [muted, setMuted] = useState(() => localStorage.getItem('traitors:muted') === '1');
  const spoken = useRef(new Set());
  const mutedRef = useRef(muted);

  useEffect(() => {
    listeners.add(setReady);
    return () => listeners.delete(setReady);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
    localStorage.setItem('traitors:muted', muted ? '1' : '0');
    if (muted && supported) window.speechSynthesis.cancel();
  }, [muted]);

  // `key` makes each announcement play at most once, no matter how often React re-renders.
  const speak = useCallback((text, key) => {
    if (!supported || mutedRef.current) return false;
    if (key) {
      if (spoken.current.has(key)) return false;
      spoken.current.add(key);
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 0.7;
    u.lang = 'en-US';
    synth.speak(u);
    return true;
  }, []);

  return { supported, ready, muted, setMuted, speak, enable: primeSpeech };
}
