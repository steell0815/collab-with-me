import { describe, expect, it } from 'vitest';
import {
  createEditState,
  isEditing,
  setEditing,
  toggleEditing
} from '../../src/client/editState';

describe('editState', () => {
  it('defaults to view mode', () => {
    const state = createEditState();
    expect(isEditing(state, 'card-1')).toBe(false);
  });

  it('toggles editing mode', () => {
    const state = createEditState();
    const first = toggleEditing(state, 'card-1');
    expect(first).toBe(true);
    expect(isEditing(state, 'card-1')).toBe(true);
    const second = toggleEditing(state, 'card-1');
    expect(second).toBe(false);
    expect(isEditing(state, 'card-1')).toBe(false);
  });

  it('sets editing explicitly', () => {
    const state = createEditState();
    setEditing(state, 'card-1', true);
    expect(isEditing(state, 'card-1')).toBe(true);
    setEditing(state, 'card-1', false);
    expect(isEditing(state, 'card-1')).toBe(false);
  });
});
