import { given, scenario, then, when } from './dsl';

scenario("Card status change notifies other users' boards", () => {
  given.userIsAuthenticated('alice');
  given.userIsAuthenticated('bob');
  given.cardExists({ title: 'Draft spec', column: 'Todo' });
  when.userMovesCard('Draft spec', 'In Progress', 'alice');
  then.boardShowsCard('Draft spec', 'In Progress');
  then.swimlaneShowsCard('Draft spec', 'In Progress');
  then.changeIsPersisted();
  then.boardIsNotied('bob');
  then.boardShowsCard('Draft spec', 'In Progress');
  then.swimlaneShowsCard('Draft spec', 'In Progress');
});

scenario('Card deletion notifies other users', () => {
  given.userIsAuthenticated('alice');
  given.userIsAuthenticated('bob');
  given.cardExists({ title: 'Remove me', column: 'Done' });
  when.userDeletesCard('Remove me', 'alice');
  then.boardIsNotied('bob');
  then.boardDoesNotShowCard('Remove me');
});
