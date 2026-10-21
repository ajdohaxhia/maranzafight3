import { describe, expect, it } from 'vitest';
import { StateMachine } from '../../src/ai/StateMachine';

describe('StateMachine', () => {
  it('calls enter and exit hooks only on real transitions', () => {
    const log: string[] = [];
    const fsm = new StateMachine<'idle' | 'chase'>('idle');
    fsm
      .add('idle', { onEnter: () => log.push('enter-idle'), onExit: () => log.push('exit-idle') })
      .add('chase', { onEnter: (from) => log.push(`enter-chase:${from}`) });
    fsm.set('idle');
    expect(log).toEqual([]);
    expect(fsm.set('chase')).toBe(true);
    expect(log).toEqual(['exit-idle', 'enter-chase:idle']);
    expect(fsm.current).toBe('chase');
    expect(fsm.previous).toBe('idle');
    fsm.set('chase');
    expect(log).toHaveLength(2);
  });

  it('tracks elapsed time', () => {
    const fsm = new StateMachine<'a'>('a');
    fsm.add('a', { duration: 2 });
    fsm.update(0.5);
    fsm.update(0.5);
    expect(fsm.elapsed).toBe(1);
    expect(fsm.normalized).toBe(0.5);
    fsm.update(2);
    expect(fsm.normalized).toBe(1);
  });

  it('ignores unknown states', () => {
    const fsm = new StateMachine<'a' | 'b'>('a');
    fsm.add('a', {});
    expect(fsm.set('b')).toBe(false);
    expect(fsm.current).toBe('a');
  });
});
