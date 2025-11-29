import { given, scenario, then, when } from './dsl';

scenario('Move card between any states freely', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec', column: 'Todo' });
  when.userMovesCard('Draft spec', 'Waste');
  then.boardShowsCard('Draft spec', 'Waste');
  then.changeIsPersisted();
});
