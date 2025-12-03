import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type Column = 'Todo' | 'In Progress' | 'Done' | 'Waste';

export type Card = {
  id: string;
  title: string;
  column: Column;
  text?: string;
  expanded: boolean;
  createdBy: string;
};

export interface BoardRepository {
  load(): BoardState;
  save(state: BoardState): void;
}

export type SwimlaneOrdering = Record<Column, string[]>;

export type BoardState = {
  cards: Card[];
  swimlanes: SwimlaneOrdering;
};

export class FileBoardRepository implements BoardRepository {
  constructor(private readonly filePath: string) {}

  load(): BoardState {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      return normalizeBoardState(data);
    } catch {
      return {
        cards: [],
        swimlanes: emptySwimlanes()
      };
    }
  }

  save(state: BoardState): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}

export interface BoardNotifier {
  notifyBoardUpdated(actorId: string, cards: Card[]): void;
}

export class NoopBoardNotifier implements BoardNotifier {
  notifyBoardUpdated(): void {
    // no-op
  }
}

export class InMemoryBoardRepository implements BoardRepository {
  private state: BoardState = {
    cards: [],
    swimlanes: emptySwimlanes()
  };

  load(): BoardState {
    return {
      cards: [...this.state.cards],
      swimlanes: cloneSwimlanes(this.state.swimlanes)
    };
  }

  save(state: BoardState): void {
    this.state = {
      cards: [...state.cards],
      swimlanes: cloneSwimlanes(state.swimlanes)
    };
  }
}

export class BoardService {
  constructor(
    private readonly repository: BoardRepository,
    private readonly notifier: BoardNotifier = new NoopBoardNotifier()
  ) {}

  createCard(userId: string, input: { title: string; column: Column; text?: string; expanded?: boolean }): Card {
    if (!userId) {
      throw new Error('User must be authenticated to create a card');
    }
    const safeTitle = sanitizeTitle(input.title);
    const safeText = sanitizeText(input.text);
    const state = this.repository.load();
    const cards = state.cards;
    const card: Card = {
      id: this.generateId(cards.length),
      title: safeTitle,
      column: input.column,
      text: safeText,
      expanded: input.expanded ?? true,
      createdBy: userId
    };
    cards.push(card);
    placeOnTop(state.swimlanes, card.column, card.id);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return card;
  }

  moveCard(userId: string, id: string, newColumn: Column): Card {
    if (!userId) {
      throw new Error('User must be authenticated to move a card');
    }
    const state = this.repository.load();
    const cards = state.cards;
    const card = cards.find((c) => c.id === id);
    if (!card) {
      throw new Error(`Card with id '${id}' not found`);
    }
    const updated = { ...card, column: newColumn };
    const updatedCards = cards.map((c) => (c.id === card.id ? updated : c));
    state.cards = updatedCards;
    removeFromSwimlanes(state.swimlanes, id);
    placeOnTop(state.swimlanes, newColumn, id);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return updated;
  }

  updateText(userId: string, id: string, text?: string): Card {
    if (!userId) {
      throw new Error('User must be authenticated to change text');
    }
    const safeText = sanitizeText(text);
    const state = this.repository.load();
    const cards = state.cards;
    const card = cards.find((c) => c.id === id);
    if (!card) {
      throw new Error(`Card with id '${id}' not found`);
    }
    const updated = { ...card, text: safeText };
    const updatedCards = cards.map((c) => (c.id === card.id ? updated : c));
    state.cards = updatedCards;
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return updated;
  }

  updateExpanded(userId: string, id: string, expanded: boolean): Card {
    if (!userId) {
      throw new Error('User must be authenticated to change expansion');
    }
    const state = this.repository.load();
    const cards = state.cards;
    const card = cards.find((c) => c.id === id);
    if (!card) {
      throw new Error(`Card with id '${id}' not found`);
    }
    const updated = { ...card, expanded };
    const updatedCards = cards.map((c) => (c.id === card.id ? updated : c));
    state.cards = updatedCards;
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return updated;
  }

  updateTitle(userId: string, id: string, newTitle: string): Card {
    if (!userId) {
      throw new Error('User must be authenticated to change title');
    }
    const safeNew = sanitizeTitle(newTitle);
    const state = this.repository.load();
    const cards = state.cards;
    const card = cards.find((c) => c.id === id);
    if (!card) {
      throw new Error(`Card with id '${id}' not found`);
    }
    const updated = { ...card, title: safeNew };
    const updatedCards = cards.map((c) => (c.id === card.id ? updated : c));
    state.cards = updatedCards;
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return updated;
  }

  deleteCard(userId: string, id: string): void {
    if (!userId) {
      throw new Error('User must be authenticated to delete a card');
    }
    const state = this.repository.load();
    const next = state.cards.filter((c) => c.id !== id);
    if (next.length === state.cards.length) {
      throw new Error(`Card with id '${id}' not found`);
    }
    state.cards = next;
    removeFromSwimlanes(state.swimlanes, id);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
  }

  listCards(): Card[] {
    const state = this.repository.load();
    return this.listCardsFromState(state);
  }

  moveCardUp(userId: string, id: string): Card {
    if (!userId) {
      throw new Error('User must be authenticated to move a card');
    }
    const state = this.repository.load();
    const card = findCardOrThrow(state.cards, id);
    bumpCard(state.swimlanes, card, -1);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return card;
  }

  moveCardDown(userId: string, id: string): Card {
    if (!userId) {
      throw new Error('User must be authenticated to move a card');
    }
    const state = this.repository.load();
    const card = findCardOrThrow(state.cards, id);
    bumpCard(state.swimlanes, card, 1);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return card;
  }

  moveCardToSwimlane(userId: string, id: string, column: Column): Card {
    if (!userId) {
      throw new Error('User must be authenticated to move a card');
    }
    const state = this.repository.load();
    const card = findCardOrThrow(state.cards, id);
    const updated = { ...card, column };
    state.cards = state.cards.map((c) => (c.id === id ? updated : c));
    removeFromSwimlanes(state.swimlanes, id);
    placeOnTop(state.swimlanes, column, id);
    this.repository.save(state);
    this.notifier.notifyBoardUpdated(userId, this.listCardsFromState(state));
    return updated;
  }

  private generateId(existingCount: number): string {
    const unique = Date.now().toString(36);
    return `card-${existingCount + 1}-${unique}`;
  }

  private listCardsFromState(state: BoardState): Card[] {
    const map = new Map(state.cards.map((c) => [c.id, c]));
    const ordered: Card[] = [];
    for (const column of SWIMLANES) {
      const lane = state.swimlanes[column] ?? [];
      for (const id of lane) {
        const card = map.get(id);
        if (card && card.column === column) {
          ordered.push(card);
          map.delete(id);
        }
      }
    }
    if (map.size > 0) {
      ordered.push(...[...map.values()].sort((a, b) => a.id.localeCompare(b.id)));
    }
    return ordered;
  }
}

export const SWIMLANES: Column[] = ['Todo', 'In Progress', 'Done', 'Waste'];

export function sanitizeTitle(title: string): string {
  const trimmed = (title ?? '').trim();
  if (!trimmed) {
    throw new Error('Title is required');
  }
  const withoutLines = trimmed.replace(/[\r\n]+/g, ' ');
  if (withoutLines.length > 200) {
    throw new Error('Title is too long');
  }
  return withoutLines;
}

export function sanitizeText(text?: string): string | undefined {
  if (text == null) return undefined;
  const trimmed = String(text).trim();
  if (!trimmed) return '';
  if (trimmed.length > 2000) {
    throw new Error('Text is too long');
  }
  return trimmed;
}

export function isColumn(value: string): value is Column {
  return SWIMLANES.includes(value as Column);
}

function emptySwimlanes(): SwimlaneOrdering {
  return {
    Todo: [],
    'In Progress': [],
    Done: [],
    Waste: []
  };
}

function normalizeBoardState(raw: unknown): BoardState {
  if (Array.isArray(raw)) {
    const cards = raw as Card[];
    return {
      cards,
      swimlanes: deriveSwimlanes(cards)
    };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Partial<BoardState>;
    const cards = Array.isArray(obj.cards) ? (obj.cards as Card[]) : [];
    const swimlanes = normalizeSwimlanes(obj.swimlanes, cards);
    return { cards, swimlanes };
  }
  return { cards: [], swimlanes: emptySwimlanes() };
}

function normalizeSwimlanes(swimlanes: SwimlaneOrdering | undefined, cards: Card[]): SwimlaneOrdering {
  const normalized = emptySwimlanes();
  const cardIds = new Set(cards.map((c) => c.id));
  for (const column of SWIMLANES) {
    const lane = swimlanes?.[column];
    if (Array.isArray(lane)) {
      const seen = new Set<string>();
      for (const id of lane) {
        if (typeof id !== 'string') continue;
        if (!cardIds.has(id)) continue;
        if (seen.has(id)) continue;
        normalized[column].push(id);
        seen.add(id);
      }
    }
  }
  for (const card of cards) {
    if (!normalized[card.column].includes(card.id)) {
      normalized[card.column].push(card.id);
    }
  }
  return normalized;
}

function deriveSwimlanes(cards: Card[]): SwimlaneOrdering {
  const swimlanes = emptySwimlanes();
  for (const card of cards) {
    if (!swimlanes[card.column]) {
      continue;
    }
    swimlanes[card.column].push(card.id);
  }
  return swimlanes;
}

function removeFromSwimlanes(swimlanes: SwimlaneOrdering, cardId: string): void {
  for (const column of SWIMLANES) {
    const lane = swimlanes[column];
    const index = lane.indexOf(cardId);
    if (index >= 0) {
      lane.splice(index, 1);
      break;
    }
  }
}

function placeOnTop(swimlanes: SwimlaneOrdering, column: Column, cardId: string): void {
  const lane = swimlanes[column] ?? [];
  const existingIdx = lane.indexOf(cardId);
  if (existingIdx >= 0) {
    lane.splice(existingIdx, 1);
  }
  lane.unshift(cardId);
  swimlanes[column] = lane;
}

function bumpCard(swimlanes: SwimlaneOrdering, card: Card, delta: -1 | 1): void {
  const lane = swimlanes[card.column] ?? [];
  let idx = lane.indexOf(card.id);
  if (idx === -1) {
    placeOnTop(swimlanes, card.column, card.id);
    return;
  }
  const nextIdx = idx + delta;
  if (nextIdx < 0 || nextIdx >= lane.length) {
    return;
  }
  [lane[idx], lane[nextIdx]] = [lane[nextIdx], lane[idx]];
}

function findCardOrThrow(cards: Card[], id: string): Card {
  const card = cards.find((c) => c.id === id);
  if (!card) {
    throw new Error(`Card with id '${id}' not found`);
  }
  return card;
}

function cloneSwimlanes(swimlanes: SwimlaneOrdering): SwimlaneOrdering {
  return {
    Todo: [...swimlanes.Todo],
    'In Progress': [...swimlanes['In Progress']],
    Done: [...swimlanes.Done],
    Waste: [...swimlanes.Waste]
  };
}
