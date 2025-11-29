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

const connectEvents = () => {
  const source = new EventSource('/events');
  source.onopen = () => setStatus('Live updates connected');
  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.cards) {
        renderCards(payload.cards);
        setStatus('Board updated');
      }
    } catch (err) {
      console.error('Failed to handle event', err);
    }
  };
  source.onerror = () => {
    setStatus('Live updates disconnected; retrying...', true);
  };
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
  if (target.matches('button[data-delete]')) {
    const cardTitle = target.getAttribute('data-title');
    const user = userEl.value.trim();
    if (!cardTitle || !user) {
      setStatus('User required to delete cards', true);
      return;
    }
    try {
      const res = await fetch('/api/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, title: cardTitle })
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(await res.text());
      }
      setStatus(`Deleted "${cardTitle}"`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error deleting card', true);
    }
  }
});

const renderCards = (cards) => {
  cardsEl.innerHTML = '';
  const lanes = ['Todo', 'In Progress', 'Done', 'Waste'];
  lanes.forEach((lane) => {
    const laneDiv = document.createElement('div');
    laneDiv.className = 'lane';
    const laneHeader = document.createElement('h3');
    laneHeader.textContent = lane;
    laneDiv.appendChild(laneHeader);

    const columnCards = cards.filter((card) => card.column === lane);
    columnCards.forEach((card) => {
      const div = document.createElement('div');
      div.className = 'card';

      const titleEl = document.createElement('strong');
      titleEl.textContent = card.title;
      div.appendChild(titleEl);

      const userEl = document.createElement('small');
      userEl.textContent = card.createdBy;
      div.appendChild(userEl);

      const actions = document.createElement('div');
      actions.className = 'actions';

      lanes
        .filter((col) => col !== card.column)
        .forEach((col) => {
          const btn = document.createElement('button');
          btn.dataset.move = col;
          btn.dataset.title = card.title;
          btn.textContent = `Move to ${col}`;
          actions.appendChild(btn);
        });

      const deleteBtn = document.createElement('button');
      deleteBtn.dataset.delete = 'true';
      deleteBtn.dataset.title = card.title;
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);

      div.appendChild(actions);
      laneDiv.appendChild(div);
    });
    cardsEl.appendChild(laneDiv);
  });
};

fetchCards().catch((err) => {
  console.error(err);
  setStatus('Failed to load cards', true);
});

connectEvents();

const versionEl = document.querySelector('#version');
const appVersion = import.meta.env?.APP_VERSION || window.APP_VERSION || '0.0.0-local';
if (versionEl) {
  versionEl.textContent = `Version: ${appVersion}`;
}
