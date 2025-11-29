export type EditState = Map<string, boolean>;

export function createEditState(): EditState {
  return new Map();
}

export function isEditing(state: EditState, id: string): boolean {
  return state.get(id) === true;
}

export function toggleEditing(state: EditState, id: string): boolean {
  const next = !isEditing(state, id);
  state.set(id, next);
  return next;
}

export function setEditing(state: EditState, id: string, value: boolean): void {
  state.set(id, value);
}
