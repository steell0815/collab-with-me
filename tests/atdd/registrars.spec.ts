import { given, scenario, then, when } from './dsl';

scenario('User registers to Card.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({ title: 'Draft spec 1', column: 'Todo' });
  when.userRegistersToCard({ title: 'Draft spec 1' });
  then.cardHasRegistrars({ title: 'Draft spec 1', registrars: ['alice'] });
  then.changeIsPersisted();
});

scenario('User unregisters from Card.', () => {
  given.userIsAuthenticated('alice');
  given.cardExists({
    title: 'Draft spec 1',
    column: 'Todo',
    registrars: ['alice']
  });
  when.userUnregistersFromCard({ title: 'Draft spec 1' });
  then.cardHasRegistrars({ title: 'Draft spec 1', registrars: [] });
  then.changeIsPersisted();
});
