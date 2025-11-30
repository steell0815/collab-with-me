const cardsEl = document.querySelector('#cards');
const statusEl = document.querySelector('#status');
const userEl = document.querySelector('#user');
const titleEl = document.querySelector('#title');
const textEl = document.querySelector('#text');
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
  const text = textEl.value;
  const column = columnEl.value;
  if (!user || !title) {
    setStatus('User and title are required', true);
    return;
  }
  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, title, column, text })
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setStatus('Card created');
    titleEl.value = '';
    textEl.value = '';
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
  if (target.matches('button[data-save-text]') || target.dataset.saveText === 'true') {
    const cardTitle = target.getAttribute('data-title');
    const user = userEl.value.trim();
    const textarea = target.parentElement.querySelector('textarea');
    const text = textarea ? textarea.value : '';
    if (!cardTitle || !user) {
      setStatus('User required to edit text', true);
      return;
    }
    try {
      const res = await fetch('/api/cards/text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, title: cardTitle, text })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setStatus(`Updated text for "${cardTitle}"`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error updating text', true);
    }
  }
  if (target.matches('button[data-edit-toggle]') || target.dataset.editToggle === 'true') {
    const cardId = target.getAttribute('data-card-id');
    if (!cardId) return;
    const next = !editState.get(cardId);
    editState.set(cardId, next);
    await fetchCards();
  }
  if (target.matches('button[data-save-details]') || target.dataset.saveDetails === 'true') {
    const cardId = target.getAttribute('data-card-id');
    const oldTitle = target.getAttribute('data-old-title');
    const user = userEl.value.trim();
    const wrapper = target.parentElement;
    const titleInput = wrapper.querySelector('input[type="text"]');
    const textarea = wrapper.querySelector('textarea');
    const newTitle = titleInput ? titleInput.value.trim() : '';
    const text = textarea ? textarea.value : '';
    if (!cardId || !oldTitle || !newTitle || !user) {
      setStatus('User and title required to edit details', true);
      return;
    }
    try {
      const resTitle = await fetch('/api/cards/title', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, oldTitle, newTitle })
      });
      if (!resTitle.ok) {
        throw new Error(await resTitle.text());
      }
      const resText = await fetch('/api/cards/text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, title: newTitle, text })
      });
      if (!resText.ok) {
        throw new Error(await resText.text());
      }
      setStatus(`Updated card "${newTitle}"`);
      editState.set(cardId, false);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error updating card', true);
    }
  }
  if (target.matches('button[data-cancel-edit]') || target.dataset.cancelEdit === 'true') {
    const cardId = target.getAttribute('data-card-id');
    if (!cardId) return;
    editState.set(cardId, false);
    await fetchCards();
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
      div.dataset.cardId = card.id;

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

      const viewBlock = document.createElement('div');
      viewBlock.className = 'view-block';
      viewBlock.appendChild(titleEl);
      viewBlock.appendChild(userEl);
      if (card.text) {
        const textElView = document.createElement('p');
        textElView.textContent = card.text;
        textElView.className = 'card-text';
        viewBlock.appendChild(textElView);
      }
      const editToggle = document.createElement('button');
      editToggle.dataset.editToggle = 'true';
      editToggle.dataset.cardId = card.id;
      editToggle.textContent = editState.get(card.id) ? 'View' : 'Edit';
      viewBlock.appendChild(editToggle);

      const editBlock = document.createElement('div');
      editBlock.className = 'edit-block';
      if (!editState.get(card.id)) {
        editBlock.classList.add('hidden');
      }
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.value = card.title;
      titleInput.dataset.oldTitle = card.title;
      titleInput.dataset.cardId = card.id;
      const textarea = document.createElement('textarea');
      textarea.value = card.text || '';
      textarea.rows = 3;
      textarea.dataset.cardId = card.id;
      const saveBtn = document.createElement('button');
      saveBtn.dataset.saveDetails = 'true';
      saveBtn.dataset.cardId = card.id;
      saveBtn.dataset.oldTitle = card.title;
      saveBtn.textContent = 'Save';
      const cancelBtn = document.createElement('button');
      cancelBtn.dataset.cancelEdit = 'true';
      cancelBtn.dataset.cardId = card.id;
      cancelBtn.textContent = 'Cancel';
      editBlock.appendChild(titleInput);
      editBlock.appendChild(textarea);
      editBlock.appendChild(saveBtn);
      editBlock.appendChild(cancelBtn);

      div.appendChild(viewBlock);
      div.appendChild(editBlock);
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

const editState = new Map();
