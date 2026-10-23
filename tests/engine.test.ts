import { describe, expect, it } from 'vitest';
import { reject } from '../src/engine/engine';

describe('engine contract', () => {
  it('reports a rejected action with its reason', () => {
    expect(reject('Not your turn')).toEqual({ ok: false, reason: 'Not your turn' });
  });
});
