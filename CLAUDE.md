# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADHDHelper is a personal single-user "brain dump" web app for an ADHD user. It records audio thoughts, transcribes them via Faster-Whisper, structures them with an AI model (LiteLLM/Ollama), classifies tasks via the Eisenhower matrix, and gamifies completion with a points system. Deployed on a private Unraid server behind Tailscale VPN.

The full specification is in `ADHDHelper-claude-code-prompt.md` (French).

## Development Commands

Once the project is scaffolded:

```bash
# Install dependencies (run from root)
npm install

# Development (concurrent backend + frontend)
npm run dev

# Build frontend for production
npm run build

# Start production server
npm start

# Generate VAPID keys (first setup)
npx web-push generate-vapid-keys
```

```bash
# Docker deployment
docker-compose up -d
docker-compose logs -f adhdhelper
```

## Architecture

**Monorepo structure:** `server/` (Node.js/Express) + `client/` (React/Vite). The Express server serves the built React app in production and proxies nothing — the frontend calls `/api/*` endpoints directly.

**Async processing pipeline:** Audio dump → Faster-Whisper transcription → LiteLLM structuring → Web Push notification → user validates tasks. This pipeline can take 30–60s; the frontend polls or uses WebSocket/SSE for status updates.

**Key constraint:** Tasks are NEVER added automatically. AI proposes, user must validate via `/api/dump/sessions/:id/validate` before tasks enter the active board.

### Backend services (`server/services/`)
- `whisper.js` — calls `POST {whisper_url}/v1/audio/transcriptions` (OpenAI-compatible)
- `llm.js` — calls `POST {litellm_url}/v1/chat/completions` with the structuring prompt
- `notification.js` — web-push with stored VAPID keys
- `scheduler.js` — two cron jobs: daily task suggestion + follow-up reminders

### Database
SQLite via `better-sqlite3`. Six tables: `sessions`, `tasks`, `points_log`, `daily_suggestions`, `settings`, `push_subscriptions`. Settings are key/value in the `settings` table (not env vars), configurable from the UI.

### Frontend pages (`client/src/pages/`)
- `DumpPage` — main screen, large mic FAB + text toggle
- `ValidationPage` — review/edit AI-proposed tasks before accepting
- `TaskBoard` — Eisenhower 2×2 matrix of active tasks
- `SessionsPage` — history of dump sessions
- `PointsPage` — gamification progress
- `SettingsPage` — LiteLLM URL/model, Whisper URL, reminder schedule, points config

## Important Rules

1. **No authentication** — single-user app, no auth needed.
2. **Language** — UI and AI prompts are in French (québécois).
3. **HTTPS not needed at app level** — Tailscale MagicDNS provides HTTPS, which is required for Service Worker push notifications.
4. **VAPID keys** must be generated once and stored in `.env` (never hardcoded).
5. **LiteLLM model list** is loaded dynamically: `GET {litellm_url}/v1/models` — the settings dropdown is not static.
6. **Eisenhower quadrant values:** `urgent_important` | `important_not_urgent` | `urgent_not_important` | `not_urgent_not_important`
7. **Points default:** 10 pts per `urgent_important` task; 50 pts to unlock a ludic task.

## AI Structuring Prompt

The prompt in `server/prompts/structurer.js` instructs the LLM to parse a raw French brain dump into structured tasks with quadrant classification. The LLM must return **valid JSON only** (no markdown/backticks). See `ADHDHelper-claude-code-prompt.md` for the full prompt template.

## Docker / Environment

Required env vars (`.env`):
```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
NODE_ENV=production
DATABASE_PATH=/app/data/adhdhelper.db
AUDIO_PATH=/app/data/audio
```

The `faster-whisper` service runs as a separate container in `docker-compose.yml`, exposed on port 9000, configured for French (`WHISPER__LANGUAGE=fr`).
