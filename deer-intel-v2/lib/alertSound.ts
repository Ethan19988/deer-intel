// A short, quiet beep for field alerts (hunt-area edge, Guide me arrival).
// iPhone Safari has no navigator.vibrate, so without a sound an alert there is
// only a banner on a screen that's in your pocket. Web Audio can't start on
// its own on iOS: the AudioContext has to be created (or resumed) inside a tap,
// so unlockAlertSound() is called from the GPS and Guide me taps. Note iOS
// still mutes it with the ringer switch on silent.

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

/** Create / resume the audio context. Call straight from a tap handler. */
export function unlockAlertSound(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  try {
    if (!context) context = new Ctor();
    if (context.state === "suspended") void context.resume().catch(() => {});
    // A silent blip inside the gesture fully unlocks output on older iOS.
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    const osc = context.createOscillator();
    osc.connect(gain);
    osc.start();
    osc.stop(context.currentTime + 0.01);
  } catch {
    // No audio: alerts stay on-screen (and vibrate where supported).
  }
}

export type AlertSoundKind = "edge" | "arrive";

// Two low beeps for the edge (a warning), a rising pair for arrival.
const TONES: Record<AlertSoundKind, Array<{ hz: number; at: number; ms: number }>> = {
  edge: [
    { hz: 660, at: 0, ms: 140 },
    { hz: 660, at: 0.22, ms: 140 },
  ],
  arrive: [
    { hz: 740, at: 0, ms: 110 },
    { hz: 988, at: 0.15, ms: 140 },
  ],
};

/** Peak volume — audible in a quiet woods, not startling. */
const VOLUME = 0.08;

/** Play an alert beep, if the context was unlocked by an earlier tap. */
export function playAlertSound(kind: AlertSoundKind): void {
  const ctx = context;
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const start = ctx.currentTime + 0.02;
    for (const tone of TONES[kind]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = start + tone.at;
      const t1 = t0 + tone.ms / 1000;
      osc.type = "sine";
      osc.frequency.value = tone.hz;
      // Quick ramp in and out so the tone doesn't click.
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(VOLUME, t0 + 0.015);
      gain.gain.setValueAtTime(VOLUME, t1 - 0.03);
      gain.gain.linearRampToValueAtTime(0, t1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.01);
    }
  } catch {
    // Ignore: the banner and vibration still fire.
  }
}
