import { isRegistered } from './registrarHelpers.js';

const cardsEl = document.querySelector('#cards');
const statusEl = document.querySelector('#status');
const titleEl = document.querySelector('#title');
const textEl = document.querySelector('#text');
const columnEl = document.querySelector('#column');
const createButton = document.querySelector('#create');
const versionEls = Array.from(document.querySelectorAll('.version-display'));
const currentUserEl = document.querySelector('#current-user');
const loginBtn = document.querySelector('#login-btn');
const logoutBtn = document.querySelector('#logout-btn');
const editState = new Map();
let currentUserId = ''; // stable identifier (prefer sub)
let currentUserDisplay = ''; // human-readable (prefer name for cards)
let cardsCache = [];

const setStatus = (text, isError = false) => {
  statusEl.textContent = text;
  statusEl.className = isError ? 'error' : 'ok';
};

const confirmDelete = async (cardTitle) => {
  return window.confirm(`Delete "${cardTitle}"?`);
};

if (loginBtn) {
  loginBtn.title = 'Login';
  loginBtn.addEventListener('click', () => {
    window.location.href = '/login';
  });
}
if (logoutBtn) {
  logoutBtn.title = 'Logout';
  logoutBtn.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.href = '/';
  });
}

const fetchMe = async () => {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error('not auth');
    const me = await res.json();
    currentUserId = me.sub || me.email || me.name || '';
    currentUserDisplay = me.name || me.email || me.sub || '';
    const headerDisplay = me.email || me.name || me.sub || '';
    if (currentUserEl) {
      currentUserEl.textContent = headerDisplay;
    }
  } catch {
    currentUserId = '';
    currentUserDisplay = '';
    if (currentUserEl) currentUserEl.textContent = 'Guest';
  }
};

const fetchCards = async () => {
  const res = await fetch('/api/cards');
  const data = await res.json();
  cardsCache = data;
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
      const title = titleEl.value.trim();
      const text = textEl.value;
      const column = columnEl.value;
      if (!currentUserId) {
        setStatus('Login required to create cards', true);
    return;
  }
  if (!title) {
    setStatus('Title is required', true);
    return;
  }
  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: currentUserDisplay || currentUserId,
        title,
        column,
        text
      })
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
  if (target.matches('button[data-register]')) {
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!currentUserId || !cardId) {
      setStatus('Login required to register', true);
      return;
    }
    try {
      await registerForCard(cardId);
      setStatus(`Registered for "${cardTitle}"`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error registering', true);
    }
  }
  if (target.matches('button[data-unregister]')) {
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!currentUserId || !cardId) {
      setStatus('Login required to unregister', true);
      return;
    }
    try {
      await unregisterFromCard(cardId);
      setStatus(`Unregistered from "${cardTitle}"`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error unregistering', true);
    }
  }
  if (target.matches('button[data-move-up]')) {
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!currentUserId || !cardId) {
      setStatus('Login required to move cards', true);
      return;
    }
    try {
      await moveCardUp(cardId);
      setStatus(`Moved "${cardTitle}" up`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error moving card', true);
    }
  }
  if (target.matches('button[data-move-down]')) {
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!currentUserId || !cardId) {
      setStatus('Login required to move cards', true);
      return;
    }
    try {
      await moveCardDown(cardId);
      setStatus(`Moved "${cardTitle}" down`);
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error moving card', true);
    }
  }
  if (target.matches('button[data-move]')) {
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    const toColumn = target.getAttribute('data-move');
    if (!currentUserId || !cardId || !toColumn) {
      setStatus('Login required to move cards', true);
      return;
    }
    try {
      const res = await fetch('/api/cards/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, id: cardId, column: toColumn })
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
    const cardId = target.getAttribute('data-card-id');
    const cardTitle = target.getAttribute('data-title') || '';
    const textarea = target.parentElement.querySelector('textarea');
    const text = textarea ? textarea.value : '';
    if (!cardId || !currentUserId) {
      setStatus('Login required to edit text', true);
      return;
    }
    try {
      const res = await fetch('/api/cards/text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, id: cardId, text })
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
  if (target.matches('button[data-expand-toggle]') || target.dataset.expandToggle === 'true') {
    const cardId = target.getAttribute('data-card-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!cardId || !currentUserId) return;
    try {
      const expanded = target.dataset.expanded !== 'true';
      const res = await fetch('/api/cards/expanded', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, id: cardId, expanded })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      if (cardId) {
        editState.set(cardId, false);
      }
      await fetchCards();
    } catch (err) {
      setStatus(err.message || 'Error toggling text', true);
    }
  }
  if (target.matches('button[data-save-details]') || target.dataset.saveDetails === 'true') {
    const cardId = target.getAttribute('data-card-id');
    const user = currentUserId;
    const wrapper = target.parentElement;
    const titleInput = wrapper.querySelector('input[type="text"]');
    const textarea = wrapper.querySelector('textarea');
    const newTitle = titleInput ? titleInput.value.trim() : '';
    const text = textarea ? textarea.value : '';
    if (!cardId || !newTitle || !user) {
      setStatus('User and title required to edit details', true);
      return;
    }
    try {
      const resTitle = await fetch('/api/cards/title', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, id: cardId, newTitle })
      });
      if (!resTitle.ok) {
        throw new Error(await resTitle.text());
      }
      const resText = await fetch('/api/cards/text', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, id: cardId, text })
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
    const cardId = target.getAttribute('data-id');
    const cardTitle = target.getAttribute('data-title') || '';
    if (!cardId || !currentUserId) {
      setStatus('Login required to delete cards', true);
      return;
    }
    const ok = await confirmDelete(cardTitle);
    if (!ok) return;
    try {
      const res = await fetch('/api/cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: currentUserId, id: cardId })
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
    laneDiv.dataset.column = lane;
    const laneHeader = document.createElement('h3');
    laneHeader.textContent = lane;
    laneDiv.appendChild(laneHeader);
    laneDiv.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    laneDiv.addEventListener('drop', async (e) => {
      e.preventDefault();
      const cardId = e.dataTransfer?.getData('text/plain');
      if (!cardId || !currentUserId) return;
      const card = cards.find((c) => c.id === cardId);
      if (!card || card.column === lane) return;
      try {
        await moveCard(cardId, lane);
      } catch (err) {
        setStatus(err.message || 'Error moving card', true);
      }
    });

    const columnCards = cards.filter((card) => card.column === lane);
    columnCards.forEach((card) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.dataset.cardId = card.id;
      div.draggable = true;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', card.id);
      });

      const titleEl = document.createElement('strong');
      titleEl.textContent = card.title;

      const userEl = document.createElement('small');
      userEl.textContent = `Creator: ${card.createdBy}`;

      const registrarsEl = document.createElement('small');
      const registrars = Array.isArray(card.registrars) ? card.registrars : [];
      registrarsEl.textContent =
        registrars.length > 0 ? `Registrars: ${registrars.join(', ')}` : 'Registrars: -';

      const actions = document.createElement('div');
      actions.className = 'actions';

      lanes
        .filter((col) => col !== card.column)
        .forEach((col) => {
          const btn = document.createElement('button');
          btn.dataset.move = col;
          btn.dataset.id = card.id;
          btn.dataset.title = card.title;
          btn.className = 'icon-btn';
          btn.title = `Move to ${col}`;
          btn.textContent =
            col === 'Todo'
              ? '🗒️'
              : col === 'In Progress'
                ? '⚙️'
                : col === 'Done'
                  ? '☑️'
                  : '🗑';
          actions.appendChild(btn);
        });

      const deleteBtn = document.createElement('button');
      deleteBtn.dataset.delete = 'true';
      deleteBtn.dataset.id = card.id;
      deleteBtn.dataset.title = card.title;
      deleteBtn.className = 'icon-btn danger';
      deleteBtn.title = 'Delete card';
      deleteBtn.textContent = '✖';
      actions.appendChild(deleteBtn);

      const viewBlock = document.createElement('div');
      viewBlock.className = 'view-block';
      viewBlock.appendChild(titleEl);
      viewBlock.appendChild(userEl);
      viewBlock.appendChild(registrarsEl);
      if (card.text && card.expanded) {
        const textElView = document.createElement('p');
        textElView.textContent = card.text;
        textElView.className = 'card-text';
        viewBlock.appendChild(textElView);
      }
      const viewActions = document.createElement('div');
      viewActions.className = 'view-actions';

      const isRegisteredToCard = isRegistered(card, currentUserId, currentUserDisplay);
      const registerBtn = document.createElement('button');
      registerBtn.className = 'icon-btn';
      registerBtn.dataset.id = card.id;
      registerBtn.dataset.title = card.title;
      if (isRegisteredToCard) {
        registerBtn.dataset.unregister = 'true';
        registerBtn.title = 'Unregister from card';
        registerBtn.textContent = '🚫';
      } else {
        registerBtn.dataset.register = 'true';
        registerBtn.title = 'Register to card';
        registerBtn.textContent = '🙋';
      }
      viewActions.appendChild(registerBtn);

      const moveUpBtn = document.createElement('button');
      moveUpBtn.dataset.moveUp = 'true';
      moveUpBtn.dataset.id = card.id;
      moveUpBtn.dataset.title = card.title;
      moveUpBtn.className = 'icon-btn';
      moveUpBtn.title = 'Move up';
      moveUpBtn.textContent = '↑';
      viewActions.appendChild(moveUpBtn);

      const moveDownBtn = document.createElement('button');
      moveDownBtn.dataset.moveDown = 'true';
      moveDownBtn.dataset.id = card.id;
      moveDownBtn.dataset.title = card.title;
      moveDownBtn.className = 'icon-btn';
      moveDownBtn.title = 'Move down';
      moveDownBtn.textContent = '↓';
      viewActions.appendChild(moveDownBtn);

      const expandToggle = document.createElement('button');
      expandToggle.dataset.expandToggle = 'true';
      expandToggle.dataset.cardId = card.id;
      expandToggle.dataset.title = card.title;
      expandToggle.className = 'icon-btn';
      expandToggle.dataset.expanded = String(!!card.expanded);
      expandToggle.title = card.expanded ? 'Hide text' : 'Show text';
      expandToggle.textContent = card.expanded ? '▾' : '▸';
      viewActions.appendChild(expandToggle);

      const editToggle = document.createElement('button');
      editToggle.dataset.editToggle = 'true';
      editToggle.dataset.cardId = card.id;
      editToggle.className = 'icon-btn';
      editToggle.title = editState.get(card.id) ? 'View' : 'Edit';
      editToggle.textContent = editState.get(card.id) ? '✖' : '✏️';
      viewActions.appendChild(editToggle);

      viewBlock.appendChild(viewActions);

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
      saveBtn.className = 'icon-btn';
      saveBtn.title = 'Save changes';
      saveBtn.textContent = '☁️';
      const cancelBtn = document.createElement('button');
      cancelBtn.dataset.cancelEdit = 'true';
      cancelBtn.dataset.cardId = card.id;
      cancelBtn.className = 'icon-btn';
      cancelBtn.title = 'Cancel editing';
      cancelBtn.textContent = '✖';
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
fetchMe();

const appVersion = import.meta.env?.APP_VERSION || window.APP_VERSION || '0.0.0-local';
if (versionEls.length) {
  versionEls.forEach((el) => {
    el.textContent = `Version: ${appVersion}`;
  });
  if (appVersion === '0.0.0-local') {
    fetch('/version.txt')
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((txt) => {
        versionEls.forEach((el) => {
          el.textContent = `Version: ${txt.trim() || appVersion}`;
        });
      })
      .catch(() => {});
  }
}

async function moveCard(cardId, column) {
  if (!currentUserId || !cardId || !column) {
    setStatus('Login required to move cards', true);
    return;
  }
  try {
    const res = await fetch('/api/cards/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: currentUserId, id: cardId, column })
    });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    setStatus(`Moved card to ${column}`);
    await fetchCards();
  } catch (err) {
    setStatus(err.message || 'Error moving card', true);
  }
}

async function moveCardUp(cardId) {
  const res = await fetch('/api/cards/move-up', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: currentUserId, id: cardId })
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function moveCardDown(cardId) {
  const res = await fetch('/api/cards/move-down', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: currentUserId, id: cardId })
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function registerForCard(cardId) {
  const res = await fetch('/api/cards/register', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: currentUserId,
      display: currentUserDisplay || currentUserId,
      id: cardId
    })
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function unregisterFromCard(cardId) {
  const res = await fetch('/api/cards/unregister', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: currentUserId,
      display: currentUserDisplay || currentUserId,
      id: cardId
    })
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}
