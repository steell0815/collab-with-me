import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type Column = 'Todo' | 'In Progress' | 'Done' | 'Waste';

export type Card = {
  id: string;
  title: string;
  column: Column;
  createdBy: string;
};

export interface BoardRepository {
  load(): Card[];
  save(cards: Card[]): void;
}

export class FileBoardRepository implements BoardRepository {
  constructor(private readonly filePath: string) {}

  load(): Card[] {
    try {
      const raw = readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? (data as Card[]) : [];
    } catch {
      return [];
    }
  }

  save(cards: Card[]): void {
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(cards, null, 2), 'utf-8');
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
  private cards: Card[] = [];

  load(): Card[] {
    return [...this.cards];
  }

  save(cards: Card[]): void {
    this.cards = [...cards];
  }
}

export class BoardService {
  constructor(
    private readonly repository: BoardRepository,
    private readonly notifier: BoardNotifier = new NoopBoardNotifier()
  ) {}

  createCard(userId: string, input: { title: string; column: Column }): Card {
    if (!userId) {
      throw new Error('User must be authenticated to create a card');
    }
    const cards = this.repository.load();
    const card: Card = {
      id: this.generateId(cards.length),
      title: input.title,
      column: input.column,
      createdBy: userId
    };
    cards.push(card);
    this.repository.save(cards);
    this.notifier.notifyBoardUpdated(userId, cards);
    return card;
  }

  moveCard(userId: string, title: string, newColumn: Column): Card {
    if (!userId) {
      throw new Error('User must be authenticated to move a card');
    }
    const cards = this.repository.load();
    const card = cards.find((c) => c.title === title);
    if (!card) {
      throw new Error(`Card with title '${title}' not found`);
    }
    const updated = { ...card, column: newColumn };
    const updatedCards = cards.map((c) => (c.id === card.id ? updated : c));
    this.repository.save(updatedCards);
    this.notifier.notifyBoardUpdated(userId, updatedCards);
    return updated;
  }

  deleteCard(userId: string, title: string): void {
    if (!userId) {
      throw new Error('User must be authenticated to delete a card');
    }
    const cards = this.repository.load();
    const next = cards.filter((c) => c.title !== title);
    if (next.length === cards.length) {
      throw new Error(`Card with title '${title}' not found`);
    }
    this.repository.save(next);
    this.notifier.notifyBoardUpdated(userId, next);
  }

  listCards(): Card[] {
    return this.repository.load();
  }

  private generateId(existingCount: number): string {
    const unique = Date.now().toString(36);
    return `card-${existingCount + 1}-${unique}`;
  }
}

export const SWIMLANES: Column[] = ['Todo', 'In Progress', 'Done', 'Waste'];
