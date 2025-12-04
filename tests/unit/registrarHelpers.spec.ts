import { describe, it, expect } from 'vitest';
import { isRegistered } from '../../public/registrarHelpers.js';

describe('isRegistered', () => {
  const baseCard = {
    registrarIds: [],
    registrars: []
  };

  it('returns true when user id is in registrarIds', () => {
    const card = { ...baseCard, registrarIds: ['abc'], registrars: ['user abc'] };
    expect(isRegistered(card, 'abc', 'user abc')).toBe(true);
  });

  it('returns true when only display name matches and ids are absent', () => {
    const card = { ...baseCard, registrars: ['display only'] };
    expect(isRegistered(card, 'id-1', 'display only')).toBe(true);
  });

  it('returns false when user not in ids or displays', () => {
    const card = { ...baseCard, registrarIds: ['other'], registrars: ['someone'] };
    expect(isRegistered(card, 'me', 'Me')).toBe(false);
  });
});
