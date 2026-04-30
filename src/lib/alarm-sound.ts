// Generates an alarm-style beeping sound using the Web Audio API.
// No external file needed.

let ctx: AudioContext | null = null;
let stopFn: (() => void) | null = null;

export function playAlarm() {
  stopAlarm();
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audio = ctx;
    let stopped = false;
    let nextTime = audio.currentTime;

    const scheduleBeep = () => {
      if (stopped) return;
      // Two-tone alarm: high then low
      [880, 660].forEach((freq, i) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        const start = nextTime + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.linearRampToValueAtTime(0, start + 0.16);
        osc.connect(gain).connect(audio.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
      nextTime += 0.7;
      // Schedule the next cycle
      setTimeout(scheduleBeep, 650);
    };

    scheduleBeep();
    stopFn = () => {
      stopped = true;
      try { audio.close(); } catch {}
    };
  } catch (e) {
    // Audio not available — silently fail
  }
}

export function stopAlarm() {
  if (stopFn) { stopFn(); stopFn = null; }
  ctx = null;
}
