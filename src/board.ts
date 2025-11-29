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
  constructor(private readonly repository: BoardRepository) {}

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
    return card;
  }

  listCards(): Card[] {
    return this.repository.load();
  }

  private generateId(existingCount: number): string {
    const unique = Date.now().toString(36);
    return `card-${existingCount + 1}-${unique}`;
  }
}
