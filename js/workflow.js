/**
 * workflow.js — AI Content Brief Pipeline
 *
 * Architecture:
 *   Stage 1 — Intent Analysis  : audience, tone, angles
 *   Stage 2 — Outline          : narrative arc + headings
 *   Stage 3 — Brief Drafting   : full editorial brief
 *   Stage 4 — Quality Check    : scores 0–100 + feedback
 *
 * Each stage passes its output as context to the next (chaining).
 * Errors are isolated per stage; upstream results are preserved.
 *
 * Security:
 *   - isRunning flag prevents concurrent duplicate runs
 *   - Topic input capped at MAX_TOPIC_LEN characters
 *   - API key injected from config.js at call time (never hard-coded)
 *   - All AI output written via textContent (no innerHTML, no XSS)
 */

const MAX_TOPIC_LEN = 300;
const STAGES = ['intent', 'outline', 'brief', 'qa'];

let isRunning  = false;   // race-condition guard
let finalBrief = '';

/* ── Prompts ─────────────────────────────────────────────────────── */

const PROMPTS = {
  intent: {
    system: `You are a senior content strategist. Analyze a topic and return a concise intent analysis
(3–4 sentences) covering: target audience, recommended content type (article / guide / listicle /
opinion), tone, and 2–3 unique angles worth exploring. Be direct and specific — no filler.`,
    user: (topic) => `Topic: ${topic}`
  },
  outline: {
    system: `You are a content architect. Given a topic and its intent analysis, generate a clean
content outline. Include: an intro hook, 4–5 section titles each with a one-line description, and a
conclusion with a clear CTA. Format as a plain-text numbered list. Be crisp and actionable.`,
    user: (topic, intent) => `Topic: ${topic}\n\nIntent context:\n${intent}`
  },
  brief: {
    system: `You are a senior editor. Write a complete, production-ready editorial content brief.
Include clearly labelled sections for: Working title, Goal (1 sentence), Target audience, Key message,
Tone & voice, Word count recommendation, SEO keywords (3–5), Types of sources to reference, and
Success metric. Use plain text with consistent label formatting. No markdown, no asterisks.`,
    user: (topic, intent, outline) =>
      `Topic: ${topic}\n\nIntent:\n${intent}\n\nOutline:\n${outline}`
  },
  qa: {
    system: `You are a content quality reviewer. Evaluate the provided content brief on three
dimensions: Clarity (is the goal unambiguous?), Specificity (are the audience and angles concrete?),
Actionability (can a writer execute this without extra guidance?). Respond with ONLY the following
format — first line is a single integer score 0–100, then a blank line, then 2–3 sentences of
feedback. No extra commentary, no labels, no markdown.`,
    user: (brief) => `Brief to evaluate:\n${brief}`
  }
};

/* ── Helpers ─────────────────────────────────────────────────────── */

function setExample(el) {
  const inp = document.getElementById('topic-input');
  inp.value = el.textContent.trim();
  updateCharCounter(inp.value.length);
  inp.focus();
}

function updateCharCounter(len) {
  const el = document.getElementById('char-counter');
  if (!el) return;
  el.textContent = `${len} / ${MAX_TOPIC_LEN}`;
  el.className = 'char-counter' +
    (len > MAX_TOPIC_LEN ? ' over' : len > MAX_TOPIC_LEN * 0.85 ? ' warn' : '');
}

function setPill(stage, state) {
  const el = document.getElementById('pill-' + stage);
  el.className = 'node-pill' + (state !== 'idle' ? ' ' + state : '');
}

function setCard(stage, state, bodyText) {
  const card   = document.getElementById('card-'   + stage);
  const status = document.getElementById('status-' + stage);
  const body   = document.getElementById('body-'   + stage);

  card.className   = 'stage-card' + (state !== 'idle' ? ' ' + state : '');
  status.className = 'stage-status status-' + state;
  status.textContent = state;

  if (bodyText === undefined) return;

  if (state === 'running') {
    // Static pulse — no user data injected into innerHTML
    body.innerHTML  = '<div class="pulse"><span></span><span></span><span></span></div>';
    body.className  = 'stage-body';
  } else {
    body.textContent = bodyText;
    body.className   = 'stage-body' + (bodyText && state === 'done' ? ' populated' : '');
  }
}

function setQualityScore(score) {
  const fill   = document.getElementById('quality-fill');
  const label  = document.getElementById('quality-score');
  const tier   = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';

  fill.className  = `quality-fill quality-fill--${tier}`;
  label.className = `quality-score quality-score--${tier}`;

  requestAnimationFrame(() => {
    fill.style.width     = score + '%';
    label.textContent    = score + '/100';
  });
}

function resetAll() {
  const defaults = {
    intent:  'Identifies audience, tone, content type, and key angles.',
    outline: 'Structures the narrative arc and section headings.',
    brief:   'Assembles a ready-to-use editorial brief.',
    qa:      'Scores clarity, specificity, and actionability.'
  };
  STAGES.forEach(s => { setCard(s, 'idle', defaults[s]); setPill(s, 'idle'); });
  document.getElementById('output-section').classList.remove('visible');
  document.getElementById('quality-bar').style.display = 'none';
  document.getElementById('quality-fill').style.width  = '0';
  document.getElementById('output-body').textContent   = '';
  finalBrief = '';
}

/* ── Anthropic API call ──────────────────────────────────────────── */

async function callClaude(system, userMsg) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key set. Click ⚙ Settings to add one.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Required for browser-side calls (Anthropic CORS policy)
      'anthropic-dangerous-request-allowlist': 'allow'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: system,
      messages: [{ role: 'user', content: userMsg }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (!text) throw new Error('Empty response from API');
  return text;
}

/* ── Main workflow ───────────────────────────────────────────────── */

async function runWorkflow() {
  // Race-condition guard — prevents duplicate concurrent runs
  if (isRunning) return;

  const topic = document.getElementById('topic-input').value.trim();
  if (!topic) { document.getElementById('topic-input').focus(); return; }

  // Enforce max length
  if (topic.length > MAX_TOPIC_LEN) {
    document.getElementById('topic-input').focus();
    return;
  }

  isRunning = true;
  const btn = document.getElementById('run-btn');
  btn.disabled    = true;
  btn.textContent = 'Running…';

  resetAll();

  try {
    // Stage 1: Intent Analysis
    setPill('intent', 'active'); setCard('intent', 'running');
    const intentResult = await callClaude(PROMPTS.intent.system, PROMPTS.intent.user(topic));
    setCard('intent', 'done', intentResult); setPill('intent', 'done');

    // Stage 2: Outline
    setPill('outline', 'active'); setCard('outline', 'running');
    const outlineResult = await callClaude(PROMPTS.outline.system, PROMPTS.outline.user(topic, intentResult));
    setCard('outline', 'done', outlineResult); setPill('outline', 'done');

    // Stage 3: Brief Drafting
    setPill('brief', 'active'); setCard('brief', 'running');
    const briefResult = await callClaude(PROMPTS.brief.system, PROMPTS.brief.user(topic, intentResult, outlineResult));
    const preview = briefResult.slice(0, 220) + (briefResult.length > 220 ? '…' : '');
    setCard('brief', 'done', preview); setPill('brief', 'done');
    finalBrief = briefResult;

    // Stage 4: Quality Check
    setPill('qa', 'active'); setCard('qa', 'running');
    const qaResult = await callClaude(PROMPTS.qa.system, PROMPTS.qa.user(briefResult));

    const lines      = qaResult.split('\n').map(l => l.trim()).filter(Boolean);
    const scoreMatch = lines[0].match(/\d+/);
    const score      = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[0]))) : 75;
    const feedback   = lines.slice(1).join(' ').trim() || qaResult;
    setCard('qa', 'done', feedback); setPill('qa', 'done');

    // Show output panel
    document.getElementById('output-body').textContent = finalBrief;
    document.getElementById('output-section').classList.add('visible');

    const qualityBar = document.getElementById('quality-bar');
    qualityBar.style.display = 'flex';
    setQualityScore(score);

  } catch (err) {
    const failedStage = STAGES.find(
      s => document.getElementById('status-' + s).textContent === 'running'
    );
    if (failedStage) {
      setCard(failedStage, 'error', 'Error: ' + (err.message || 'Request failed. Try again.'));
      setPill(failedStage, 'error');
    }
    // Do NOT log err.message — it might contain the API key in some edge cases
    console.error('[Workflow error]', err.name);
  }

  isRunning       = false;
  btn.disabled    = false;
  btn.textContent = 'Run workflow ↗';
}

/* ── Copy handler ────────────────────────────────────────────────── */

function copyBrief() {
  if (!finalBrief) return;
  navigator.clipboard.writeText(finalBrief).then(() => {
    const btn  = document.querySelector('.btn-copy');
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1800);
  });
}

/* ── Boot ────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  initConfig();

  // Character counter
  document.getElementById('topic-input').addEventListener('input', (e) => {
    updateCharCounter(e.target.value.length);
  });

  // Enter key shortcut
  document.getElementById('topic-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runWorkflow();
  });
});
