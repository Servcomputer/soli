
class SoundService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private speed: number = 1;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  playCardMove() {
    if (!this.enabled) return;
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx!.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx!.destination);

    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  playShuffle() {
    if (!this.enabled) return;
    this.init();
    const interval = 60 / this.speed;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200 + Math.random() * 200, this.ctx!.currentTime);
        gain.gain.setValueAtTime(0.05, this.ctx!.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start();
        osc.stop(this.ctx!.currentTime + 0.05);
      }, i * interval);
    }
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    const interval = 150 / this.speed;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx!.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start();
        osc.stop(this.ctx!.currentTime + 0.5);
      }, i * interval);
    });
  }
}

export const soundService = new SoundService();
