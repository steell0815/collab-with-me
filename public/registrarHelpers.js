export function isRegistered(card, currentUserId, currentUserDisplay) {
  if (!card) return false;
  const registrarIds = Array.isArray(card.registrarIds) ? card.registrarIds : [];
  const registrars = Array.isArray(card.registrars) ? card.registrars : [];
  if (currentUserId && registrarIds.includes(currentUserId)) return true;
  if (currentUserDisplay && registrars.includes(currentUserDisplay)) return true;
  return false;
}
