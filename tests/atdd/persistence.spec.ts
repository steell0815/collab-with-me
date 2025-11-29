import { given, scenario, then, when } from './dsl';

scenario('Cards are physically persisted.', () => {
  given.userIsAuthenticated('alice');
  when.userCreatesCard({ title: 'Write tests', column: 'Todo' });
  then.changeIsPersisted();
  when.systemRestarts();
  then.boardShowsCard('Write tests', 'Todo');
});
