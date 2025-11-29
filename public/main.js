const cardsEl = document.querySelector('#cards');
const statusEl = document.querySelector('#status');
const userEl = document.querySelector('#user');
const titleEl = document.querySelector('#title');
const columnEl = document.querySelector('#column');
const createButton = document.querySelector('#create');

const setStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = isError ? 'error' : 'ok';
};

const fetchCards = async () => {
  const res = await fetch('/api/cards');
  const data = await res.json();
  renderCards(data);
};

createButton.addEventListener('click', async () => {
  const user = userEl.value.trim();
  const title = titleEl.value.trim();
  const column = columnEl.value;
  if (!user || !title) {
    setStatus('User and title are required', true);
    return;
  }
  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, title, column })
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setStatus('Card created');
    titleEl.value = '';
    await fetchCards();
  } catch (err) {
    setStatus(err.message || 'Error creating card', true);
  }
});

cardsEl.addEventListener('click', async (event) => {
  const target = event.target;
  if (target.matches('button[data-move]')) {
    const cardTitle = target.getAttribute('data-title');
    const toColumn = target.getAttribute('data-move');
    const user = userEl.value.trim();
    if (!cardTitle || !toColumn || !user) {
      setStatus('User required to move cards', true);
      return;
    }
    try {
      const res = await fetch('/api/cards/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, title: cardTitle, column: toColumn })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setStatus(`Moved "${cardTitle}" to ${toColumn}`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error moving card', true);
    }
  }
});

const renderCards = (cards) => {
  cardsEl.innerHTML = '';
  cards.forEach((card) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <strong>${card.title}</strong>
      <span>${card.column}</span>
      <small>${card.createdBy}</small>
      <div class="actions">
        ${['Todo', 'In Progress', 'Done', 'Waste']
          .filter((col) => col !== card.column)
          .map(
            (col) =>
              `<button data-move="${col}" data-title="${card.title}">Move to ${col}</button>`
          )
          .join('')}
      </div>
    `;
    cardsEl.appendChild(div);
  });
};

fetchCards().catch((err) => {
  console.error(err);
  setStatus('Failed to load cards', true);
});
