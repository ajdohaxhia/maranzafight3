import { GamepadInput } from './GamepadInput';
import { KeyboardInput, type ActionKey } from './KeyboardInput';
import { TouchControls, type TouchAction } from './TouchControls';

export type InputAction =
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

export interface InputCallbacks {
  onPauseRequested(): void;
  onAnyGesture(): void;
}

const GAMEPAD_ACTIONS: Record<number, InputAction> = {
  0: 'punch',
  2: 'kick',
  1: 'dodge',
  3: 'special',
  4: 'interact',
  5: 'reload',
  7: 'fire',
  6: 'switchWeapon',
  9: 'pause',
};

export class InputManager {
  readonly touch: TouchControls;
  readonly gamepad = new GamepadInput();
  readonly keyboard: KeyboardInput;
  moveX = 0;
  moveY = 0;
  run = false;
  enabled = false;
  pointerLocked = false;
  shooterMode = false;
  private mouseFire = false;

  private readonly buffer = new Map<InputAction, number>();
  private readonly callbacks: InputCallbacks;
  private readonly canvas: HTMLCanvasElement;
  private lookX = 0;
  private lookY = 0;
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragMoved = 0;
  private dragButton = 0;
  private ignoreUnlockUntil = 0;
  private readonly onMouseDown: (event: MouseEvent) => void;
  private readonly onMouseMove: (event: MouseEvent) => void;
  private readonly onMouseUp: (event: MouseEvent) => void;
  private readonly onPointerLockChange: () => void;
  private readonly onContextMenu: (event: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: InputCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.touch = new TouchControls({
      onAction: (action) => this.trigger(action),
      onLook: (dx, dy) => this.addLook(dx, dy),
    });
    this.keyboard = new KeyboardInput(
      (action: ActionKey) => {
        if (action === 'pause') {
          this.callbacks.onPauseRequested();
        } else {
          this.trigger(action);
        }
      },
      () => undefined,
    );

    this.onMouseDown = (event: MouseEvent) => this.handleMouseDown(event);
    this.onMouseMove = (event: MouseEvent) => this.handleMouseMove(event);
    this.onMouseUp = (event: MouseEvent) => this.handleMouseUp(event);
    this.onPointerLockChange = () => {
      const locked = document.pointerLockElement === this.canvas;
      const wasLocked = this.pointerLocked;
      this.pointerLocked = locked;
      if (!locked && wasLocked && this.enabled && performance.now() > this.ignoreUnlockUntil) {
        this.callbacks.onPauseRequested();
      }
    };
    this.onContextMenu = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest('#app')) {
        event.preventDefault();
      }
    };

    this.attach();
  }

  attach(): void {
    this.keyboard.attach();
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointerdown', this.callbacks.onAnyGesture, { passive: true });
    window.addEventListener('keydown', this.callbacks.onAnyGesture, { passive: true });
  }

  detach(): void {
    this.keyboard.detach();
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointerdown', this.callbacks.onAnyGesture);
    window.removeEventListener('keydown', this.callbacks.onAnyGesture);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.touch.setEnabled(enabled);
    if (!enabled) {
      this.buffer.clear();
      this.lookX = 0;
      this.lookY = 0;
      this.dragging = false;
      this.moveX = 0;
      this.moveY = 0;
      this.run = false;
      this.mouseFire = false;
      this.touch.reset();
      this.exitPointerLock();
    }
  }

  setDeadzone(percent: number): void {
    this.touch.setDeadzone(percent);
  }

  /** Shooting layout: left click fires, right click swaps slot, R reloads. */
  setShooterMode(enabled: boolean): void {
    this.shooterMode = enabled;
    this.mouseFire = false;
    this.buffer.clear();
  }

  update(dt: number): void {
    this.gamepad.update();
    this.touch.update(dt);

    let x = 0;
    let y = 0;
    if (this.enabled) {
      x = this.keyboard.moveX;
      y = this.keyboard.moveY;
      if (this.touch.magnitude > 0.01) {
        x = this.touch.moveX;
        y = this.touch.moveY;
      } else if (Math.hypot(this.gamepad.moveX, this.gamepad.moveY) > 0.12) {
        x = this.gamepad.moveX;
        y = this.gamepad.moveY;
      }
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      const gamepadLookScale = 620 * dt;
      this.lookX += this.gamepad.lookX * gamepadLookScale;
      this.lookY += this.gamepad.lookY * gamepadLookScale;

      for (const [index, action] of Object.entries(GAMEPAD_ACTIONS)) {
        const buttonIndex = Number(index);
        if (!this.gamepad.wasPressed(buttonIndex)) continue;
        if (action === 'pause') {
          this.callbacks.onPauseRequested();
        } else {
          this.trigger(action);
        }
      }
    }
    this.moveX = x;
    this.moveY = y;
    this.run = this.enabled && (this.keyboard.running || this.touch.magnitude > 0.86 || this.gamepad.run);

    // Expire the input buffer in game time, not wall clock: on a slow frame a
    // tap queued 300 ms ago must still start a punch, not vanish unread.
    for (const [action, ttl] of this.buffer) {
      const next = ttl - dt;
      if (next <= 0) this.buffer.delete(action);
      else this.buffer.set(action, next);
    }
  }

  consume(action: InputAction): boolean {
    if (!this.buffer.has(action)) return false;
    this.buffer.delete(action);
    return true;
  }

  isDown(action: InputAction): boolean {
    if (!this.enabled) return false;
    const touchDown = this.touch.downActions.has(action as TouchAction);
    const keyboardDown =
      (action === 'dodge' && this.keyboard.keys.has('Space')) ||
      (action === 'special' && this.keyboard.keys.has('KeyQ')) ||
      (action === 'interact' && this.keyboard.keys.has('KeyE')) ||
      (action === 'punch' && this.keyboard.keys.has('KeyJ')) ||
      (action === 'kick' && this.keyboard.keys.has('KeyK')) ||
      (action === 'fire' && (this.mouseFire || this.keyboard.keys.has('KeyF')));
    const padIndex = Object.entries(GAMEPAD_ACTIONS).find(([, value]) => value === action)?.[0];
    const gamepadDown = padIndex !== undefined && this.gamepad.isDown(Number(padIndex));
    return touchDown || keyboardDown || gamepadDown;
  }

  trigger(action: InputAction): void {
    if (!this.enabled) return;
    this.buffer.set(action, Math.max(this.buffer.get(action) ?? 0, 0.34));
  }

  consumeLook(): { x: number; y: number } {
    const x = this.lookX;
    const y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  clearTransient(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.buffer.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.touch.reset();
  }

  requestPointerLock(): void {
    if (this.touch.isTouchDevice) return;
    if (document.pointerLockElement === this.canvas) return;
    try {
      const request = this.canvas.requestPointerLock?.();
      if (request instanceof Promise) request.catch(() => undefined);
    } catch {
      /* Safari may refuse; drag-look fallback still works */
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      this.ignoreUnlockUntil = performance.now() + 350;
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
  }

  private addLookFromMouse(dx: number, dy: number): void {
    if (Math.abs(dx) > 200 || Math.abs(dy) > 200) return;
    this.addLook(dx, dy);
  }

  private handleMouseDown(event: MouseEvent): void {
    if (!this.enabled || this.touch.isTouchDevice) return;
    if (event.button !== 0 && event.button !== 2) return;
    this.callbacks.onAnyGesture();
    event.preventDefault();
    if (this.pointerLocked) {
      if (this.shooterMode) {
        if (event.button === 0) {
          this.mouseFire = true;
          this.trigger('fire');
        } else {
          this.trigger('switchWeapon');
        }
        return;
      }
      if (event.button === 0) this.trigger('punch');
      else this.trigger('kick');
      return;
    }
    if (this.shooterMode && event.button === 0) {
      this.mouseFire = true;
      this.trigger('fire');
    }
    this.dragging = true;
    this.dragButton = event.button;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragMoved = 0;
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.enabled || this.touch.isTouchDevice) return;
    if (this.pointerLocked) {
      this.addLookFromMouse(event.movementX, event.movementY);
      return;
    }
    if (!this.dragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragMoved += Math.abs(dx) + Math.abs(dy);
    this.addLook(dx, dy);
  }

  private handleMouseUp(event: MouseEvent): void {
    if (event.button === 0) this.mouseFire = false;
    if (event.button !== this.dragButton) return;
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragMoved < 8) {
      if (this.shooterMode) {
        return;
      }
      if (this.dragButton === 0) this.trigger('punch');
      else this.trigger('kick');
    }
  }
}
