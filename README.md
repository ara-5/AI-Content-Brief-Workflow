# AI Content Brief Workflow

A lightweight, browser-based tool that transforms any topic into a **production-ready content brief** using a four-stage chained AI pipeline.

🔗 **Live demo:** [ara-5.github.io/AI-Content-Brief-Workflow](https://ara-5.github.io/AI-Content-Brief-Workflow/)

---

## What It Does

You give it a topic — e.g. *"The rise of agentic AI"* — and it runs four sequential AI-powered stages, each feeding its output into the next:

| Stage | What it does |
|-------|-------------|
| **1. Intent Analysis** | Identifies target audience, tone, content type, and 2–3 unique angles |
| **2. Outline** | Builds a narrative arc with intro hook, 4–5 section headings, and a CTA |
| **3. Brief Drafting** | Writes a full editorial brief: title, keywords, word count, voice, success metric |
| **4. Quality Check** | Scores the brief 0–100 on clarity, specificity, and actionability |

The result is a copy-ready document a writer could use immediately.

---

## Why Chained Calls?

Instead of one large prompt, the pipeline breaks the task into **four specialised steps**. Each stage's output becomes the next stage's input — so the final brief is informed by all the analysis that came before it. This is a common pattern in AI workflow automation and produces significantly better output than a single monolithic prompt.

---

## File Structure

```
AI Content Brief Workflow/
├── index.html        — Page shell, API key modal, CSP header
├── css/
│   └── styles.css    — All styling (light + dark mode)
├── js/
│   ├── config.js     — API key management (localStorage)
│   └── workflow.js   — Pipeline logic, API calls, UI updates
├── .gitignore
└── README.md
```

---

## Getting Started

### 1. Prerequisites

You need an **Anthropic API key**. Get one at [console.anthropic.com](https://console.anthropic.com). Usage is billed per token — a typical full run costs under $0.02.

### 2. Run It

No build step required. Just open `index.html` in any modern browser.

> **Note:** Because the app makes direct API requests from the browser, you cannot open `index.html` via `file://` with some browsers (Chrome blocks cross-origin fetches from file: URLs). Use a simple local server instead:
>
> ```bash
> # Python (built-in)
> python -m http.server 8080
>
> # Node (if installed)
> npx serve .
> ```
> Then open `http://localhost:8080`.

### 3. Enter Your API Key

On first load, the app will prompt you for your Anthropic API key. It is:
- Stored in your browser's `localStorage` only
- Sent exclusively to `api.anthropic.com`
- Never logged or written to the DOM after entry
- Masked with `type="password"` while you type

Click **⚙ Settings** at any time to update or remove it.

---

## Security Model

| Concern | How it's handled |
|---------|-----------------|
| API key visibility | `type="password"` input; cleared from DOM immediately after save |
| Key persistence | `localStorage` only; never in source code or URL |
| API key in logs | Error handler logs `err.name` only, never `err.message` |
| Runaway API calls | 300-character topic limit enforced at input and in JS |
| Duplicate runs | `isRunning` flag prevents concurrent workflow executions |
| Network access | CSP restricts `connect-src` to `api.anthropic.com` only |
| XSS from AI output | All responses written via `textContent`, never `innerHTML` |

---

## Customising the Prompts

All four system prompts live in `js/workflow.js` in the `PROMPTS` object. Each entry has:

```js
PROMPTS.intent = {
  system: `Your system prompt here…`,
  user:   (topic) => `Topic: ${topic}`
}
```

Edit them freely — the pipeline structure stays the same regardless of what you put in the prompts.

---

## Browser Support

Works in any browser that supports `fetch`, `async/await`, and `localStorage` — all modern browsers qualify. No dependencies, no build tools.

---

## License

MIT — use freely, modify as needed.

---

Developed with ❤️ by Athira
