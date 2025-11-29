import { given, scenario, then, when } from './dsl';

scenario('Board shows four swimlanes.', () => {
  given.userIsAuthenticated('alice');
  then.boardShowSwimlane({ title: 'Todo', column: 'Todo' });
  then.boardShowSwimlane({ title: 'In Progress', column: 'In Progress' });
  then.boardShowSwimlane({ title: 'Done', column: 'Done' });
  then.boardShowSwimlane({ title: 'Waste', column: 'Waste' });
});

scenario('Card status change, changes swimlane.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec', column: 'Todo' });
  when.userMovesCard('Draft spec', 'In Progress');
  then.boardShowsCard('Draft spec', 'In Progress');
  then.swimlaneShowsCard('Draft spec', 'In Progress');
  then.changeIsPersisted();
});
