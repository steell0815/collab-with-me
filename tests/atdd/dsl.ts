import { expect, test } from 'vitest';
import { mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  BoardService,
  BoardNotifier,
  Column,
  FileBoardRepository,
  SWIMLANES
} from '../../src/board';

type TestContext = {
  currentUser?: string;
  authenticatedUsers: Set<string>;
  repository: FileBoardRepository;
  service: BoardService;
  notifications: Map<string, number>;
  dataFile: string;
  notifier: BoardNotifier;
};

let context: TestContext | null = null;

const createContext = (): TestContext => {
  const tempDir = mkdtempSync(join(tmpdir(), 'board-'));
  const dataFile = join(tempDir, 'board.json');
  const repository = new FileBoardRepository(dataFile);
  const notifications = new Map<string, number>();
  const authenticatedUsers = new Set<string>();

  const notifier: BoardNotifier = {
    notifyBoardUpdated: (actorId: string, cards) => {
      [...authenticatedUsers]
        .filter((user) => user !== actorId)
        .forEach((user) => {
          const count = notifications.get(user) ?? 0;
          notifications.set(user, count + 1);
        });
    }
  };

  const service = new BoardService(repository, notifier);
  return {
    repository,
    service,
    notifications,
    authenticatedUsers,
    dataFile,
    notifier
  };
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
  cardExists: ({
    title,
    column,
    text,
    expanded
  }: {
    title: string;
    column: Column;
    text?: string;
    expanded?: boolean;
  }) => {
    const ctx = ensureContext();
    if (!ctx.currentUser) {
      throw new Error('No authenticated user in context');
    }
    ctx.service.createCard(ctx.currentUser, { title, column, text, expanded });
  },
  swimlaneShowsCardInOrder: ({
    column,
    titles
  }: {
    column: Column;
    titles: string[];
  }) => {
    then.swimlaneShowsCardInOrder({ column, titles });
  }
};

export const when = {
  userCreatesCard: ({
    title,
    column,
    text
  }: {
    title: string;
    column: Column;
    text?: string;
  }) => {
    const ctx = ensureContext();
    if (!ctx.currentUser) {
      throw new Error('No authenticated user in context');
    }
    const card = ctx.service.createCard(ctx.currentUser, { title, column, text });
    return card.id;
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
    const id = resolveId(title);
    ctx.service.moveCard(actor, id, column);
  },
  userChangesText: ({
    title,
    text
  }: {
    title: string;
    text?: string;
  }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    const id = resolveId(title);
    ctx.service.updateText(actor, id, text);
  },
  expandCardText: ({ title }: { title: string }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    const id = resolveId(title);
    ctx.service.updateExpanded(actor, id, true);
  },
  collapseCardText: ({ title }: { title: string }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    const id = resolveId(title);
    ctx.service.updateExpanded(actor, id, false);
  },
  userChangesTitle: ({
    oldTitle,
    newTitle
  }: {
    oldTitle: string;
    newTitle: string;
  }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    const id = resolveId(oldTitle);
    ctx.service.updateTitle(actor, id, newTitle);
  },
  systemRestarts: () => {
    const ctx = ensureContext();
    const repository = new FileBoardRepository(ctx.dataFile);
    ctx.repository = repository;
    ctx.service = new BoardService(repository, ctx.notifier);
  },
  userDeletesCard: (title: string, userId?: string) => {
    const ctx = ensureContext();
    const actor = userId ?? ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    if (!ctx.authenticatedUsers.has(actor)) {
      throw new Error(`User ${actor} not authenticated`);
    }
    const id = resolveId(title);
    ctx.service.deleteCard(actor, id);
  },
  userMovesCardUp: ({ title, column }: { title: string; column: Column }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    if (!ctx.authenticatedUsers.has(actor)) {
      throw new Error(`User ${actor} not authenticated`);
    }
    const id = resolveId(title);
    const card = ctx.service.listCards().find((c) => c.id === id);
    if (!card || card.column !== column) {
      throw new Error(`Card ${title} not in column ${column}`);
    }
    ctx.service.moveCardUp(actor, id);
  },
  userMovesCardDown: ({ title, column }: { title: string; column: Column }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    if (!ctx.authenticatedUsers.has(actor)) {
      throw new Error(`User ${actor} not authenticated`);
    }
    const id = resolveId(title);
    const card = ctx.service.listCards().find((c) => c.id === id);
    if (!card || card.column !== column) {
      throw new Error(`Card ${title} not in column ${column}`);
    }
    ctx.service.moveCardDown(actor, id);
  },
  userMovesCardToSwimlane: ({
    title,
    column
  }: {
    title: string;
    column: Column;
  }) => {
    const ctx = ensureContext();
    const actor = ctx.currentUser;
    if (!actor) {
      throw new Error('No authenticated user in context');
    }
    if (!ctx.authenticatedUsers.has(actor)) {
      throw new Error(`User ${actor} not authenticated`);
    }
    const id = resolveId(title);
    ctx.service.moveCardToSwimlane(actor, id, column);
  }
};

export const then = {
  boardShowsCard: (title: string, textOrColumn: string | Column, columnMaybe?: Column, expanded?: boolean) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    let found;
    if (columnMaybe) {
      const text = typeof textOrColumn === 'string' ? textOrColumn : undefined;
      const column = columnMaybe;
      found = cards.find(
        (card) =>
          card.title === title &&
          card.column === column &&
          (text === undefined || (card.text ?? '') === text) &&
          (expanded === undefined || card.expanded === expanded)
      );
    } else {
      const column = textOrColumn as Column;
      found = cards.find((card) => card.title === title && card.column === column);
    }
    expect(found).toBeDefined();
  },
  boardDoesNotShowCard: (title: string) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    const found = cards.find((card) => card.title === title);
    expect(found).toBeUndefined();
  },
  swimlaneShowsCard: (title: string, column: Column, _viewer?: string) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards();
    const found = cards.find(
      (card) => card.title === title && card.column === column
    );
    expect(found).toBeDefined();
  },
  swimlaneShowsCardInOrder: ({
    column,
    titles
  }: {
    column: Column;
    titles: string[];
  }) => {
    const ctx = ensureContext();
    const cards = ctx.service.listCards().filter((card) => card.column === column);
    expect(cards.map((card) => card.title)).toEqual(titles);
  },
  boardShowSwimlane: ({ title, column }: { title: string; column: Column }) => {
    expect(SWIMLANES).toContain(column);
    const expectedTitle = column === 'In Progress' ? 'In Progress' : column;
    expect(title).toBe(expectedTitle);
  },
  boardIsNotied: (userId: string) => {
    const ctx = ensureContext();
    const count = ctx.notifications.get(userId) ?? 0;
    expect(count).toBeGreaterThan(0);
  },
  changeIsPersisted: () => {
    const ctx = ensureContext();
    const persisted = ctx.repository.load();
    expect(persisted.cards.length).toBeGreaterThan(0);
  }
};

const ensureContext = (): TestContext => {
  if (!context) {
    throw new Error('Test context not initialized');
  }
  return context;
};

const resolveId = (title: string): string => {
  const ctx = ensureContext();
  const found = ctx.service.listCards().find((c) => c.title === title);
  if (!found) {
    throw new Error(`Card with title '${title}' not found`);
  }
  return found.id;
};
