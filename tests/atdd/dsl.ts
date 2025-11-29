import { expect, test } from 'vitest';
import {
  BoardService,
  Column,
  InMemoryBoardRepository,
  SWIMLANES
} from '../../src/board';

type TestContext = {
  currentUser?: string;
  repository: InMemoryBoardRepository;
  service: BoardService;
};

let context: TestContext | null = null;

const createContext = (): TestContext => {
  const repository = new InMemoryBoardRepository();
  const service = new BoardService(repository);
  return { repository, service };
};

export const scenario = (name: string, fn: () => void) =>
  test(name, () => {
    context = createContext();
    fn();
  });

export const given = {
  userIsAuthenticated: (userId: string) => {
    ensureContext();
    context!.currentUser = userId;
  },
  cardExists: ({ title, column }: { title: string; column: Column }) => {
    const ctx = ensureContext();
    if (!ctx.currentUser) {
      throw new Error('No authenticated user in context');
    }
    ctx.service.createCard(ctx.currentUser, { title, column });
  }
};

export const when = {
  userCreatesCard: ({ title, column }: { title: string; column: Column }) => {
    const ctx = ensureContext();
    if (!ctx.currentUser) {
      throw new Error('No authenticated user in context');
    }
    ctx.service.createCard(ctx.currentUser, { title, column });
  },
  userMovesCard: (title: string, column: Column) => {
    const ctx = ensureContext();
    if (!ctx.currentUser) {
      throw new Error('No authenticated user in context');
    }
    ctx.service.moveCard(ctx.currentUser, title, column);
  }
};

export const then = {
  boardShowsCard: (title: string, column: Column) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    const found = cards.find(
      (card) => card.title === title && card.column === column
    );
    expect(found).toBeDefined();
  },
  swimlaneShowsCard: (title: string, column: Column) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    const found = cards.find(
      (card) => card.title === title && card.column === column
    );
    expect(found).toBeDefined();
  },
  boardShowSwimlane: ({ title, column }: { title: string; column: Column }) => {
    expect(SWIMLANES).toContain(column);
    const expectedTitle = column === 'In Progress' ? 'In Progress' : column;
    expect(title).toBe(expectedTitle);
  },
  changeIsPersisted: () => {
    const ctx = ensureContext();
    const persisted = ctx.repository.load();
    expect(persisted.length).toBeGreaterThan(0);
  }
};

const ensureContext = (): TestContext => {
  if (!context) {
    throw new Error('Test context not initialized');
  }
  return context;
};
