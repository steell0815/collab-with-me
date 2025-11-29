import { expect, test } from 'vitest';
import {
  BoardService,
  BoardNotifier,
  Column,
  InMemoryBoardRepository,
  SWIMLANES
} from '../../src/board';

type TestContext = {
  currentUser?: string;
  authenticatedUsers: Set<string>;
  repository: InMemoryBoardRepository;
  service: BoardService;
  notifications: Map<string, Array<{ title: string; column: Column }>>;
};

let context: TestContext | null = null;

const createContext = (): TestContext => {
  const repository = new InMemoryBoardRepository();
  const notifications = new Map<string, Array<{ title: string; column: Column }>>();
  const authenticatedUsers = new Set<string>();

  const notifier: BoardNotifier = {
    notifyCardChanged: (actorId: string, card: { title: string; column: Column }) => {
      [...authenticatedUsers]
        .filter((user) => user !== actorId)
        .forEach((user) => {
          const list = notifications.get(user) || [];
          list.push({ title: card.title, column: card.column });
          notifications.set(user, list);
        });
    }
  };

  const service = new BoardService(repository, notifier);
  return { repository, service, notifications, authenticatedUsers };
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
    context!.authenticatedUsers.add(userId);
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
  userMovesCard: (title: string, column: Column, userId?: string) => {
    const ctx = ensureContext();
    const actor = userId ?? ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    if (!ctx.authenticatedUsers.has(actor)) {
      throw new Error(`User ${actor} not authenticated`);
    }
    ctx.service.moveCard(actor, title, column);
  }
};

export const then = {
  boardShowsCard: (title: string, column: Column, _viewer?: string) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    const found = cards.find(
      (card) => card.title === title && card.column === column
    );
    expect(found).toBeDefined();
  },
  swimlaneShowsCard: (title: string, column: Column, _viewer?: string) => {
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
  boardIsNotied: (userId: string) => {
    const ctx = ensureContext();
    const list = ctx.notifications.get(userId) || [];
    expect(list.length).toBeGreaterThan(0);
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
