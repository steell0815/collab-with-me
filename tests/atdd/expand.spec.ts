import { given, scenario, then, when } from './dsl';

scenario('Cards are displayed in text collapsed.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({
    title: 'Draft spec',
    column: 'Todo',
    text: 'Some text',
    expanded: false
  });
  then.boardShowsCard('Draft spec', 'Some text', 'Todo', false);
});

scenario('Card text is expanded.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({
    title: 'Draft spec',
    column: 'Todo',
    text: 'Some text',
    expanded: false
  });
  then.boardShowsCard('Draft spec', 'Some text', 'Todo', false);
  when.expandCardText({ title: 'Draft spec' });
  then.boardShowsCard('Draft spec', 'Some text', 'Todo', true);
  then.changeIsPersisted();
});
