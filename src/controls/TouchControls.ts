export type TouchAction = 'punch' | 'kick' | 'dodge' | 'special' | 'interact';

export interface TouchCallbacks {
  onAction(action: TouchAction): void;
  onLook(dx: number, dy: number): void;
}

const REPEATABLE: Record<string, number> = {
  punch: 0.24,
  kick: 0.34,
  special: 1.1,
};

/**
 * Real multitouch controls:
 * - one pointer owns the joystick, one owns the camera, buttons own themselves
 * - pointer capture per element, reset on cancel/blur/visibility change
 */
export class TouchControls {
  readonly isTouchDevice: boolean;
  enabled = false;
  moveX = 0;
  moveY = 0;
  magnitude = 0;
  readonly downActions = new Set<TouchAction>();

  private readonly stick: HTMLElement | null;
  private readonly knob: HTMLElement | null;
  private readonly interactButton: HTMLElement | null;
  private readonly callbacks: TouchCallbacks;
  private stickPointer: number | null = null;
  private lookPointer: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private stickCenterX = 0;
  private stickCenterY = 0;
  private stickRadius = 1;
  private deadzone = 0.18;
  private readonly repeatTimers = new Map<TouchAction, number>();
  private readonly buttonPointers = new Map<number, { element: HTMLElement; action: TouchAction }>();

  constructor(callbacks: TouchCallbacks) {
    this.callbacks = callbacks;
    this.isTouchDevice =
      (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window !== 'undefined' && 'ontouchstart' in window);

    if (typeof document !== 'undefined') {
      document.body.classList.toggle('is-touch', this.isTouchDevice);
      document.body.classList.toggle('is-desktop', !this.isTouchDevice);
    }

    this.stick = document.getElementById('stick');
    this.knob = document.getElementById('stick-knob');
    this.interactButton = document.getElementById('touch-interact');

    this.bindStick();
    this.bindButtons();
    this.bindLook();
    this.bindReset();

    const rotateAnyway = document.getElementById('btn-rotate-anyway');
    rotateAnyway?.addEventListener('click', () => {
      document.body.classList.add('allow-portrait');
    });
  }

  setDeadzone(percent: number): void {
    this.deadzone = Math.min(0.45, Math.max(0, percent / 100));
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  setInteractVisible(visible: boolean): void {
    this.interactButton?.classList.toggle('is-active', visible && this.enabled);
  }

  update(dt: number): void {
    if (!this.enabled) return;
    for (const action of [...this.downActions]) {
      const interval = REPEATABLE[action];
      if (!interval) continue;
      const timer = (this.repeatTimers.get(action) ?? 0) - dt;
      if (timer <= 0) {
        this.callbacks.onAction(action);
        this.repeatTimers.set(action, interval);
      } else {
        this.repeatTimers.set(action, timer);
      }
    }
  }

  private bindStick(): void {
    if (!this.stick) return;
    this.stick.addEventListener(
      'pointerdown',
      (event: PointerEvent) => {
        if (!this.enabled || this.stickPointer !== null) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = this.stick?.getBoundingClientRect();
        if (!rect) return;
        this.stickCenterX = rect.left + rect.width / 2;
        this.stickCenterY = rect.top + rect.height / 2;
        this.stickRadius = rect.width * 0.42;
        this.stickPointer = event.pointerId;
        try {
          this.stick?.setPointerCapture(event.pointerId);
        } catch {
          /* capture can fail on some embedded browsers */
        }
        this.updateStick(event.clientX, event.clientY);
      },
      { passive: false },
    );

    window.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        if (event.pointerId === this.stickPointer) {
          if (!this.enabled) return;
          event.preventDefault();
          this.updateStick(event.clientX, event.clientY);
        }
      },
      { passive: false },
    );

    const release = (event: PointerEvent): void => {
      if (event.pointerId === this.stickPointer) {
        this.releaseStick();
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    this.stick.addEventListener('lostpointercapture', () => this.releaseStick());
  }

  private updateStick(clientX: number, clientY: number): void {
    const dx = clientX - this.stickCenterX;
    const dy = clientY - this.stickCenterY;
    const dist = Math.hypot(dx, dy);
    const raw = Math.min(1, dist / Math.max(1, this.stickRadius));
    let magnitude = 0;
    if (raw > this.deadzone) {
      magnitude = (raw - this.deadzone) / (1 - this.deadzone);
    }
    if (magnitude <= 0.001 || dist < 0.001) {
      this.moveX = 0;
      this.moveY = 0;
      this.magnitude = 0;
      if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    this.moveX = nx * magnitude;
    this.moveY = -ny * magnitude;
    this.magnitude = magnitude;
    if (this.knob) {
      const travel = this.stickRadius * Math.min(1, raw);
      this.knob.style.transform = `translate(calc(-50% + ${nx * travel}px), calc(-50% + ${ny * travel}px))`;
    }
  }

  private releaseStick(): void {
    this.stickPointer = null;
    this.moveX = 0;
    this.moveY = 0;
    this.magnitude = 0;
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private bindButtons(): void {
    const buttons = document.querySelectorAll<HTMLElement>('.tbtn[data-action]');
    for (const button of buttons) {
      const action = button.dataset.action as TouchAction | undefined;
      if (!action) continue;
      button.addEventListener(
        'pointerdown',
        (event: PointerEvent) => {
          if (!this.enabled) return;
          event.preventDefault();
          event.stopPropagation();
          if (this.downActions.has(action)) return;
          try {
            button.setPointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
          this.buttonPointers.set(event.pointerId, { element: button, action });
          this.downActions.add(action);
          this.repeatTimers.set(action, REPEATABLE[action] ?? 0);
          button.classList.add('is-pressed');
          this.callbacks.onAction(action);
        },
        { passive: false },
      );

      const release = (event: PointerEvent): void => {
        const tracked = this.buttonPointers.get(event.pointerId);
        if (!tracked || tracked.element !== button) return;
        this.buttonPointers.delete(event.pointerId);
        this.downActions.delete(tracked.action);
        this.repeatTimers.delete(tracked.action);
        button.classList.remove('is-pressed');
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    }
  }

  private bindLook(): void {
    window.addEventListener(
      'pointerdown',
      (event: PointerEvent) => {
        if (!this.enabled) return;
        if (event.pointerType === 'mouse') return;
        if (this.lookPointer !== null) return;
        const target = event.target;
        if (target instanceof Element && target.closest('.tbtn, #stick, button, input, .screen.is-active')) return;
        this.lookPointer = event.pointerId;
        this.lookLastX = event.clientX;
        this.lookLastY = event.clientY;
      },
      { passive: true },
    );

    window.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        if (event.pointerId !== this.lookPointer) return;
        if (!this.enabled) return;
        const dx = event.clientX - this.lookLastX;
        const dy = event.clientY - this.lookLastY;
        this.lookLastX = event.clientX;
        this.lookLastY = event.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          this.callbacks.onLook(dx, dy);
        }
      },
      { passive: true },
    );

    const end = (event: PointerEvent): void => {
      if (event.pointerId === this.lookPointer) {
        this.lookPointer = null;
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  private bindReset(): void {
    const reset = (): void => {
      this.reset();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') reset();
    });
    window.addEventListener('orientationchange', reset);
  }

  reset(): void {
    this.releaseStick();
    this.lookPointer = null;
    this.buttonPointers.clear();
    this.downActions.clear();
    this.repeatTimers.clear();
    this.moveX = 0;
    this.moveY = 0;
    this.magnitude = 0;
    for (const button of document.querySelectorAll('.tbtn.is-pressed')) {
      button.classList.remove('is-pressed');
    }
  }
}
