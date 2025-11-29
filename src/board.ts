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

export interface BoardNotifier {
  notifyCardChanged(actorId: string, card: Card): void;
}

export class NoopBoardNotifier implements BoardNotifier {
  notifyCardChanged(): void {
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
    this.notifier.notifyCardChanged(userId, card);
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
    this.notifier.notifyCardChanged(userId, updated);
    return updated;
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
