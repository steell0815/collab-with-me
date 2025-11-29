import { test } from 'vitest';

type Column = 'Todo' | 'In Progress' | 'Done' | 'Waste';

const unimplemented = (name: string) => () => {
  throw new Error(`${name} not implemented`);
};

export const scenario = test.skip;

export const given = {
  userIsAuthenticated: (userId: string) =>
    unimplemented(`Authenticate user ${userId}`)()
};

export const when = {
  userCreatesCard: ({ title, column }: { title: string; column: Column }) =>
    unimplemented(`Create card '${title}' in ${column}`)()
};

export const then = {
  boardShowsCard: (title: string, column: Column) =>
    unimplemented(`Board should show card '${title}' in ${column}`)(),
  changeIsPersisted: () =>
    unimplemented('Change should be persisted')()
};
