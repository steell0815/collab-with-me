import { given, scenario, then, when } from './dsl';

scenario('Create a card into Todo', () => {
  given.userIsAuthenticated('alice');
  when.userCreatesCard({ title: 'Write tests', column: 'Todo' });
  then.boardShowsCard('Write tests', 'Todo');
  then.changeIsPersisted();
});
