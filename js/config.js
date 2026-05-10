/**
 * config.js — API key management
 *
 * Security model:
 *  - Key stored in localStorage under a non-obvious name.
 *  - Never written into the DOM as visible text after saving.
 *  - Input field is type="password" and cleared after saving.
 *  - No key is ever logged to the console.
 *  - Format validated (must start with "sk-ant-") before saving.
 */

const KEY_STORE    = 'acbw_k';      // localStorage key name
const VALID_PREFIX = 'sk-ant-';     // Anthropic key prefix

/* ── Public API ─────────────────────────────────────────────────── */

function getApiKey() {
  return localStorage.getItem(KEY_STORE) || null;
}

/** Validates format, saves the key. Returns error string or null. */
function saveApiKey(raw) {
  const key = (raw || '').trim();
  if (!key) return 'Please enter your API key.';
  if (!key.startsWith(VALID_PREFIX)) return `Key must start with "${VALID_PREFIX}…"`;
  if (key.length < 40) return 'Key looks too short — double-check it.';
  localStorage.setItem(KEY_STORE, key);
  return null;
}

function clearApiKey() {
  localStorage.removeItem(KEY_STORE);
}

/* ── Modal lifecycle ─────────────────────────────────────────────── */

function openKeyModal(showClearOption = false) {
  const overlay  = document.getElementById('key-modal');
  const clearBtn = document.getElementById('modal-clear-btn');
  const errorEl  = document.getElementById('modal-error');
  if (clearBtn) clearBtn.style.display = showClearOption ? 'inline' : 'none';
  if (errorEl)  errorEl.textContent = '';
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    const inp = document.getElementById('key-input');
    if (inp) { inp.value = ''; inp.focus(); }
  });
}

function closeKeyModal() {
  document.getElementById('key-modal').classList.add('hidden');
  const inp = document.getElementById('key-input');
  if (inp) inp.value = '';
}

function handleSaveKey() {
  const inp     = document.getElementById('key-input');
  const errorEl = document.getElementById('modal-error');
  const err     = saveApiKey(inp ? inp.value : '');
  if (err) { if (errorEl) errorEl.textContent = err; return; }
  if (inp) inp.value = '';
  closeKeyModal();
}

function handleClearKey() {
  clearApiKey();
  closeKeyModal();
}

/* ── Initialization ──────────────────────────────────────────────── */

function initConfig() {
  document.getElementById('save-key-btn')
    .addEventListener('click', handleSaveKey);

  const clearBtn = document.getElementById('modal-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', handleClearKey);

  document.getElementById('key-input')
    .addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSaveKey(); });

  document.getElementById('settings-btn')
    .addEventListener('click', () => openKeyModal(!!getApiKey()));

  // Auto-show if no key is saved
  if (!getApiKey()) openKeyModal(false);
}
