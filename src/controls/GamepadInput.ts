export class GamepadInput {
  connected = false;
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  run = false;
  readonly buttons: boolean[] = [];
  readonly justPressed: boolean[] = [];
  private prev: boolean[] = [];
  private pad: Gamepad | null = null;

  update(): void {
    this.justPressed.fill(false);
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.run = false;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (candidate && candidate.connected) {
        pad = candidate;
        break;
      }
    }
    this.pad = pad;
    this.connected = Boolean(pad);
    if (!pad) return;

    const axes = pad.axes;
    const dz = 0.16;
    const apply = (value: number): number => (Math.abs(value) < dz ? 0 : (value - Math.sign(value) * dz) / (1 - dz));
    this.moveX = apply(axes[0] ?? 0);
    this.moveY = -apply(axes[1] ?? 0);
    const lookX = apply(axes[2] ?? 0);
    const lookY = apply(axes[3] ?? 0);
    this.lookX = Math.abs(lookX) > 0.05 ? Math.sign(lookX) * Math.pow(Math.abs(lookX), 1.6) : 0;
    this.lookY = Math.abs(lookY) > 0.05 ? Math.sign(lookY) * Math.pow(Math.abs(lookY), 1.6) : 0;
    this.run = Boolean(pad.buttons[10]?.pressed);

    for (let i = 0; i < pad.buttons.length; i++) {
      const pressed = Boolean(pad.buttons[i]?.pressed);
      this.buttons[i] = pressed;
      this.justPressed[i] = pressed && !this.prev[i];
    }
    this.prev = this.buttons.slice();
  }

  isDown(index: number): boolean {
    return Boolean(this.buttons[index]);
  }

  wasPressed(index: number): boolean {
    return Boolean(this.justPressed[index]);
  }

  get id(): string {
    return this.pad?.id ?? '';
  }
}
