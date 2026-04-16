# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADHDHelper is a personal single-user "brain dump" web app for an ADHD user. It records audio thoughts, transcribes them via Faster-Whisper, structures them with an AI model (LiteLLM), classifies tasks by priority (1–10), and gamifies completion with a points system. Deployed on a private Unraid server behind Tailscale VPN with Caddy as reverse proxy.

The full specification is in `ADHDHelper-claude-code-prompt.md` (French).

## Git Workflow

- **Always work on a feature branch** — never commit directly to `main`.
- Branch naming: `feat/nom-feature` or `fix/nom-bug`.
- Open a GitHub PR when the feature is ready.
- **Never merge into `main` without explicit user approval.**

## Development Commands

```bash
# Install dependencies (run from root)
npm install

# Development (concurrent backend + frontend)
npm run dev

# Build frontend for production
npm run build

# Start production server
npm start

# Generate VAPID keys (first setup only)
npx web-push generate-vapid-keys
```

```bash
# Docker — use `docker compose` (v2), not `docker-compose` (v1 is broken on this machine)
docker compose up -d --build adhdhelper
docker compose logs -f adhdhelper
```

## Architecture

**Monorepo structure:** `server/` (Node.js/Express) + `client/` (React/Vite). The Express server serves the built React app in production. The frontend calls `/api/*` endpoints directly.

**Async processing pipeline:** Audio dump → Faster-Whisper transcription → LiteLLM structuring → Web Push notification → user validates tasks. This pipeline can take 30–60s; the frontend polls every 3s for status updates.

**Key constraint:** Tasks are NEVER added automatically. AI proposes, user must validate via `/api/dump/sessions/:id/validate` before tasks enter the active board.

### Backend services (`server/services/`)
- `whisper.js` — calls `POST {whisper_url}/v1/audio/transcriptions` (OpenAI-compatible)
- `llm.js` — calls `POST {litellm_url}/v1/chat/completions` with the structuring prompt
- `notification.js` — web-push with stored VAPID keys
- `scheduler.js` — two cron jobs: daily task suggestion + follow-up reminders

### Database
SQLite via `better-sqlite3`. Six tables: `sessions`, `tasks`, `points_log`, `daily_suggestions`, `settings`, `push_subscriptions`. Settings are key/value in the `settings` table (not env vars), configurable from the UI.

### Frontend pages (`client/src/pages/`)
- `DumpPage` — main screen, mic button + text toggle
- `ValidationPage` — review/edit AI-proposed tasks before accepting
- `TaskBoard` — tasks grouped by priority (high/medium/low), with daily task highlight
- `SessionsPage` — history of dump sessions
- `PointsPage` — monthly points history with expandable task lists
- `SettingsPage` — LiteLLM URL/model, Whisper URL, reminder schedule, points config, push notifications

### Frontend components (`client/src/components/`)
- `AudioRecorder` — mic button with animated recording rings
- `NavBar` — fixed bottom nav, 4 tabs, badge on Dump when sessions are ready
- `PriorityBoard` — collapsible sections: haute (7–10) / moyenne (4–6) / basse (1–3)
- `TaskCard` — checkbox, title, points, edit on tap
- `TaskEditModal` — modal to edit title, description, priority; delete with confirmation

## UI / Design

- **Mode clair** (light mode) — background `slate-50`, white cards, navy headings.
- **Font:** Nunito (Google Fonts) — loaded in `client/index.html`.
- **Primary accent:** blue-600 (`#2563eb`).
- **Priority colors:** rose (high), orange (medium), teal (low).
- **Tailwind config:** `client/tailwind.config.js` — fontFamily extended with Nunito, custom `navy` color.
- **Global CSS:** `client/src/styles/tailwind.css` — defines `.card`, `.btn-primary`, recording ring animations, toast-rise animation.

## Important Rules

1. **No authentication** — single-user app, no auth needed.
2. **Language** — UI and AI prompts are in French (québécois).
3. **HTTPS not needed at app level** — Caddy + Tailscale MagicDNS handle TLS, required for Service Worker push notifications.
4. **VAPID keys** must be generated once and stored in `.env` (never hardcoded).
5. **LiteLLM model list** is loaded dynamically: `GET {litellm_url}/v1/models` — the settings dropdown is not static.
6. **Priority is a number 1–10** (not Eisenhower quadrant strings) — grouped in the UI as high/medium/low.
7. **Points default:** configurable via settings; stored in `points_log` table.
8. **`docker-compose` (v1) is broken** on this machine — always use `docker compose` (v2).

## AI Structuring Prompt

The prompt in `server/prompts/structurer.js` instructs the LLM to parse a raw French brain dump into structured tasks with priority 1–10. The LLM must return **valid JSON only** (no markdown/backticks). See `ADHDHelper-claude-code-prompt.md` for the full prompt template.

## Docker / Environment

**Three services in `docker-compose.yml`:**
- `adhdhelper` — Node.js app, port 3000, built from `Dockerfile`
- `faster-whisper` — `fedirz/faster-whisper-server:latest-cpu`, port 9000, French language
- `caddy` — reverse proxy with TLS, reads `Caddyfile`

Required env vars (`.env`):
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
NODE_ENV=production
DATABASE_PATH=/app/data/adhdhelper.db
AUDIO_PATH=/app/data/audio
```

Persistent data is mounted at `./data/` (excluded from git via `.gitignore`).
