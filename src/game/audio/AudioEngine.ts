import type { GameEvent } from "@/game/events/gameEvents";

interface AudioEngineOptions {
  masterVolume?: number;
}

export class AudioEngine {
  private readonly context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private slotLoopIntervalId: number | null = null;
  private slotStepIndex = 0;
  private readonly masterVolume: number;
  private isSlotSpinning = false;
  private feverTimeoutId: number | null = null;
  private feverGain: GainNode | null = null;
  private feverOscillators: OscillatorNode[] = [];

  constructor(options: AudioEngineOptions = {}) {
    this.masterVolume = options.masterVolume ?? 0.28;

    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return;
    }

    this.context = new window.AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.context.destination);
  }

  handleGameEvent(event: GameEvent): void {
    switch (event.type) {
      case "GAME_STARTED":
        this.resume();
        this.playStartFanfare();
        break;
      case "SLOT_START_SPIN":
        this.startSlotLoop();
        break;
      case "SLOT_STOP_REEL":
        this.playReelStop();
        break;
      case "SLOT_WIN":
        this.stopSlotLoop();
        this.playWinFanfare(event.ballCount);
        break;
      case "SLOT_LOSE":
        this.stopSlotLoop();
        this.playLoseBlip();
        break;
      case "BALL_LAUNCHED":
        this.playLaunchBlip();
        break;
      case "BLOCK_HIT":
        this.playHitBlip();
        break;
      case "BLOCK_EXPLODED":
        this.playExplosion();
        break;
      case "MEDAL_EARNED":
        this.playMedalPickup();
        break;
      case "FEVER_STARTED":
        this.startFever();
        break;
      default:
        break;
    }
  }

  private resume(): void {
    if (this.context?.state === "suspended") {
      this.context.resume();
    }
  }

  private startSlotLoop(): void {
    if (this.context === null || this.masterGain === null || this.isSlotSpinning) {
      return;
    }

    this.isSlotSpinning = true;
    this.slotStepIndex = 0;
    const tickMs = 110;

    const scheduleTick = () => {
      if (!this.isSlotSpinning || this.context === null || this.masterGain === null) {
        return;
      }

      const now = this.context.currentTime;
      const note = [220, 277.18, 329.63, 440][this.slotStepIndex % 4];
      this.slotStepIndex += 1;

      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(now);
      oscillator.stop(now + 0.1);
    };

    scheduleTick();
    this.slotLoopIntervalId = window.setInterval(scheduleTick, tickMs);
  }

  private stopSlotLoop(): void {
    this.isSlotSpinning = false;

    if (this.slotLoopIntervalId !== null) {
      window.clearInterval(this.slotLoopIntervalId);
      this.slotLoopIntervalId = null;
    }
  }

  private playReelStop(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
  }

  private playWinFanfare(ballCount: number): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = this.context.currentTime;
    const duration = 0.14;
    const extraSteps = Math.min(ballCount, 10);

    for (let index = 0; index < notes.length + extraSteps; index += 1) {
      const note = notes[index % notes.length] * (1 + Math.floor(index / notes.length) * 0.05);
      const start = now + index * duration;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(note, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }
  }

  private playLoseBlip(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(220, now);
    oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.25);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  }

  private playLaunchBlip(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }

  private playHitBlip(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  private playExplosion(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const noiseDuration = 0.45;
    const sampleRate = this.context.sampleRate;
    const bufferSize = Math.floor(sampleRate * noiseDuration);
    const buffer = this.context.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.55, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + noiseDuration);
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + noiseDuration);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + noiseDuration + 0.05);

    const boomOscillator = this.context.createOscillator();
    const boomGain = this.context.createGain();
    boomOscillator.type = "sine";
    boomOscillator.frequency.setValueAtTime(120, now);
    boomOscillator.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    boomGain.gain.setValueAtTime(0.0001, now);
    boomGain.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    boomOscillator.connect(boomGain);
    boomGain.connect(this.masterGain);
    boomOscillator.start(now);
    boomOscillator.stop(now + 0.4);
  }

  private playMedalPickup(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const now = this.context.currentTime;
    const notes = [880, 1318.51];

    for (let index = 0; index < notes.length; index += 1) {
      const start = now + index * 0.07;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(notes[index], start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(start);
      oscillator.stop(start + 0.2);
    }
  }

  private playStartFanfare(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const notes = [523.25, 659.25, 783.99];
    const now = this.context.currentTime;

    for (let index = 0; index < notes.length; index += 1) {
      const start = now + index * 0.12;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(notes[index], start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(this.masterGain);
      oscillator.start(start);
      oscillator.stop(start + 0.22);
    }
  }

  private startFever(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    this.stopFever();

    const now = this.context.currentTime;
    const duration = 25;

    // 「キュインキュインキュイーン」効果音
    // 3回上昇するサイレンのような音
    const sirenBaseFreq = 523.25; // C5
    const sirenTopFreq = 1046.5;  // C6 (1オクターブ上)
    const riseTime = 0.35;
    const fallTime = 0.15;
    const pauseTime = 0.1;
    const cycleTime = riseTime + fallTime + pauseTime;

    this.feverGain = this.context.createGain();
    this.feverGain.gain.setValueAtTime(0.0001, now);
    this.feverGain.gain.linearRampToValueAtTime(0.25, now + 0.3);
    this.feverGain.connect(this.masterGain);

    const feverGainNode = this.feverGain;

    // メインのサイレン音（2オシレーターで太く）
    for (let oscIndex = 0; oscIndex < 2; oscIndex += 1) {
      const oscillator = this.context!.createOscillator();
      const detune = oscIndex === 0 ? 0 : 8; // 8セントずらして厚みを出す
      oscillator.type = oscIndex === 0 ? "sawtooth" : "triangle";
      oscillator.detune.value = detune;

      // 3回上昇する周波数エンベロープ
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const cycleStart = now + cycle * cycleTime;
        const riseEnd = cycleStart + riseTime;
        const fallEnd = riseEnd + fallTime;

        oscillator.frequency.setValueAtTime(sirenBaseFreq, cycleStart);
        oscillator.frequency.linearRampToValueAtTime(sirenTopFreq, riseEnd);
        oscillator.frequency.linearRampToValueAtTime(sirenBaseFreq * 0.7, fallEnd);
      }

      // 最後の「キュイーン」を長く伸ばす
      const finalStart = now + 3 * cycleTime;
      const finalRiseEnd = finalStart + 0.5;
      const finalHoldEnd = finalStart + 2.0;

      oscillator.frequency.setValueAtTime(sirenBaseFreq, finalStart);
      oscillator.frequency.linearRampToValueAtTime(sirenTopFreq * 1.2, finalRiseEnd);
      oscillator.frequency.linearRampToValueAtTime(sirenTopFreq * 1.2, finalHoldEnd);

      oscillator.connect(feverGainNode);
      oscillator.start(now);
      oscillator.stop(now + duration);

      this.feverOscillators.push(oscillator);
    }

    // リズム用のビート音（キュインのタイミングで「タン」）
    for (let beat = 0; beat < 3; beat += 1) {
      const beatTime = now + beat * cycleTime;
      const beatOsc = this.context!.createOscillator();
      const beatGain = this.context!.createGain();
      beatOsc.type = "square";
      beatOsc.frequency.setValueAtTime(880, beatTime);
      beatGain.gain.setValueAtTime(0.0001, beatTime);
      beatGain.gain.exponentialRampToValueAtTime(0.15, beatTime + 0.02);
      beatGain.gain.exponentialRampToValueAtTime(0.0001, beatTime + 0.12);
      beatOsc.connect(beatGain);
      beatGain.connect(feverGainNode);
      beatOsc.start(beatTime);
      beatOsc.stop(beatTime + 0.15);
      this.feverOscillators.push(beatOsc);
    }

    // 最後の伸ばす音のタイミングで additional beat
    const finalBeatTime = now + 3 * cycleTime;
    const finalBeatOsc = this.context!.createOscillator();
    const finalBeatGain = this.context!.createGain();
    finalBeatOsc.type = "square";
    finalBeatOsc.frequency.setValueAtTime(1174.66, finalBeatTime); // D6
    finalBeatGain.gain.setValueAtTime(0.0001, finalBeatTime);
    finalBeatGain.gain.exponentialRampToValueAtTime(0.18, finalBeatTime + 0.03);
    finalBeatGain.gain.exponentialRampToValueAtTime(0.0001, finalBeatTime + 0.2);
    finalBeatOsc.connect(finalBeatGain);
    finalBeatGain.connect(feverGainNode);
    finalBeatOsc.start(finalBeatTime);
    finalBeatOsc.stop(finalBeatTime + 0.25);
    this.feverOscillators.push(finalBeatOsc);

    this.feverTimeoutId = window.setTimeout(() => this.stopFever(), 25_000);
  }

  private stopFever(): void {
    if (this.feverTimeoutId !== null) {
      window.clearTimeout(this.feverTimeoutId);
      this.feverTimeoutId = null;
    }

    if (this.feverGain !== null && this.context !== null) {
      const now = this.context.currentTime;
      this.feverGain.gain.cancelScheduledValues(now);
      this.feverGain.gain.setValueAtTime(this.feverGain.gain.value, now);
      this.feverGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    }

    this.feverOscillators.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // 既に停止済みの場合は無視する
      }
    });
    this.feverOscillators = [];
    this.feverGain = null;
  }

  dispose(): void {
    this.stopSlotLoop();
    this.stopFever();
    this.context?.close();
  }
}
