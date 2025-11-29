import { given, scenario, then, when } from './dsl';

scenario("Card status change notifies other users' boards", () => {
  given.userIsAuthenticated('alice');
  given.userIsAuthenticated('bob');
  given.cardExists({ title: 'Draft spec', column: 'Todo' });
  when.userMovesCard('Draft spec', 'In Progress', 'alice');
  then.boardShowsCard('Draft spec', 'In Progress', 'alice');
  then.swimlaneShowsCard('Draft spec', 'In Progress', 'alice');
  then.changeIsPersisted();
  then.boardIsNotied('bob');
  then.boardShowsCard('Draft spec', 'In Progress', 'bob');
  then.swimlaneShowsCard('Draft spec', 'In Progress', 'bob');
});
