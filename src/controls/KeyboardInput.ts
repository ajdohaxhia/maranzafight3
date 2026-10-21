export type ActionKey =
  | 'punch'
  | 'kick'
  | 'dodge'
  | 'special'
  | 'interact'
  | 'pause'
  | 'fire'
  | 'reload'
  | 'switchWeapon'
  | 'slot1'
  | 'slot2';

const ACTION_MAP: Record<string, ActionKey> = {
  KeyQ: 'special',
  Space: 'dodge',
  KeyE: 'interact',
  Escape: 'pause',
  KeyP: 'pause',
  KeyF: 'fire',
  KeyR: 'reload',
  Digit1: 'slot1',
  Digit2: 'slot2',
};

export class KeyboardInput {
  readonly keys = new Set<string>();
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onBlur: () => void;
  private readonly actionHandler: (action: ActionKey) => void;
  private readonly moveHandler: () => void;

  constructor(onAction: (action: ActionKey) => void, onMoveChanged: () => void) {
    this.actionHandler = onAction;
    this.moveHandler = onMoveChanged;
    this.onKeyDown = (event: KeyboardEvent) => {
      const code = event.code;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (code === 'Space' || code.startsWith('Arrow')) event.preventDefault();
      this.keys.add(code);
      if (!event.repeat) {
        const action = ACTION_MAP[code];
        if (action) this.actionHandler(action);
      }
      this.moveHandler();
    };
    this.onKeyUp = (event: KeyboardEvent) => {
      this.keys.delete(event.code);
      this.moveHandler();
    };
    this.onBlur = () => {
      this.keys.clear();
      this.moveHandler();
    };
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  get moveX(): number {
    let x = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    return x;
  }

  get moveY(): number {
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    return y;
  }

  get running(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }
}
