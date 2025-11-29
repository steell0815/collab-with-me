import { given, scenario, then, when } from './dsl';

scenario('Create a card with Text', () => {
  given.userIsAuthenticated('alice');
  when.userCreatesCard({
    title: 'Write tests',
    column: 'Todo',
    text: 'Lorem ipsum dolor...'
  });
  then.boardShowsCard('Write tests', 'Lorem ipsum dolor...', 'Todo');
  then.changeIsPersisted();
});

scenario('Change the text of a card', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({
    title: 'Write tests',
    column: 'Todo',
    text: 'Lorem ipsum dolor...'
  });
  when.userChangesText({
    title: 'Write tests',
    text: 'And now something completely different.'
  });
  then.boardShowsCard('Write tests', 'And now something completely different.', 'Todo');
  then.changeIsPersisted();
});

scenario('Change the title of a card', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({
    title: 'Write tests',
    column: 'Todo',
    text: 'Lorem ipsum dolor...'
  });
  when.userChangesTitle({
    oldTitle: 'Write tests',
    newTitle: 'Write even more tests'
  });
  then.boardShowsCard('Write even more tests', 'Lorem ipsum dolor...', 'Todo');
  then.changeIsPersisted();
});
