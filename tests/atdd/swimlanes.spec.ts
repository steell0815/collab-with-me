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

scenario('Swimlanes order cards.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  given.cardExists({ title: 'Draft spec 2', column: 'Todo' });
  then.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 2', 'Draft spec 1']
  });
});

scenario('Newly created Cards are always on top.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  when.userCreatesCard({ title: 'Write tests', column: 'Todo' });
  then.changeIsPersisted();
  then.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Write tests', 'Draft spec 1']
  });
});

scenario('Move Card up on swimlane.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  given.cardExists({ title: 'Draft spec 2', column: 'Todo' });
  given.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 2', 'Draft spec 1']
  });
  when.userMovesCardUp({ title: 'Draft spec 1', column: 'Todo' });
  then.changeIsPersisted();
  then.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 1', 'Draft spec 2']
  });
});

scenario('Move Card down on swimlane.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  given.cardExists({ title: 'Draft spec 2', column: 'Todo' });
  given.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 2', 'Draft spec 1']
  });
  when.userMovesCardDown({ title: 'Draft spec 2', column: 'Todo' });
  then.changeIsPersisted();
  then.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 1', 'Draft spec 2']
  });
});

scenario('Move Card to another swimlane.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  given.cardExists({ title: 'Draft spec 2', column: 'Todo' });
  given.cardExists({ title: 'Draft spec 3', column: 'In Progress' });
  given.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 2', 'Draft spec 1']
  });
  given.swimlaneShowsCardInOrder({
    column: 'In Progress',
    titles: ['Draft spec 3']
  });
  when.userMovesCardToSwimlane({ title: 'Draft spec 1', column: 'In Progress' });
  then.changeIsPersisted();
  then.swimlaneShowsCardInOrder({
    column: 'Todo',
    titles: ['Draft spec 2']
  });
  then.swimlaneShowsCardInOrder({
    column: 'In Progress',
    titles: ['Draft spec 1', 'Draft spec 3']
  });
});
