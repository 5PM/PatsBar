/** A short generic voiced grunt, synthesized locally; no recordings or downloads. */
export class GameAudio {
  context?: AudioContext;
  private buffer?: AudioBuffer;
  muted = false;

  constructor() {
    const unlock = () => {
      try {
        this.context ??= new AudioContext();
        if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
      } catch { /* Audio is optional on browsers without Web Audio. */ }
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
  }

  hurt() {
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    if (!this.buffer) {
      this.buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .34), ctx.sampleRate);
      const data = this.buffer.getChannelData(0);
      let phase = 0, breath = 0;
      for (let i = 0; i < data.length; i++) {
        const t = i / ctx.sampleRate, progress = t / .34;
        // Falling pitch and vowel formants make a soft, throaty "uh".
        const pitch = 125 - 48 * progress + 3 * Math.sin(t * 95);
        phase += 2 * Math.PI * pitch / ctx.sampleRate;
        let voice = 0;
        for (let harmonic = 1; harmonic <= 24; harmonic++) {
          const hz = pitch * harmonic;
          const formant = .65 * Math.exp(-(((hz - 520) / 190) ** 2))
            + .3 * Math.exp(-(((hz - 1250) / 280) ** 2)) + .08;
          voice += Math.sin(phase * harmonic) * formant / Math.sqrt(harmonic);
        }
        breath = breath * .7 + (Math.random() * 2 - 1) * .3;
        const envelope = Math.min(1, t / .018) * Math.pow(1 - progress, 1.4);
        data[i] = Math.tanh(voice * 1.6 + breath * .18) * envelope * .42;
      }
    }
    const source = ctx.createBufferSource(); source.buffer = this.buffer;
    source.playbackRate.value = .95 + Math.random() * .1;
    source.connect(ctx.destination); source.onended = () => source.disconnect(); source.start();
  }
}
