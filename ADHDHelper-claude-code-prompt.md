# ADHDHelper — Claude Code Project Prompt

## Contexte

Tu construis **ADHDHelper**, une webapp personnelle de type "brain dump" conçue pour un utilisateur TDAH. L'app permet de vider ses pensées (principalement par audio), les faire transcrire et structurer par IA, les classer selon la matrice d'Eisenhower, et gamifier la productivité avec un système de points.

L'app est hébergée sur un serveur **Unraid**, accessible uniquement via **Tailscale**. Elle communique avec un serveur distant **Ollama/LiteLLM** pour le traitement IA, et un container local **Faster-Whisper** pour la transcription audio.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   UNRAID SERVER                      │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  ADHDHelper  │  │ Faster-      │  │  SQLite    │ │
│  │  (Docker)    │  │ Whisper      │  │  Database  │ │
│  │              │  │ (Docker)     │  │            │ │
│  │  - React     │  │              │  └────────────┘ │
│  │    (PWA)     │  │  Port: 9000  │                  │
│  │  - Node.js   │  └──────────────┘                  │
│  │  - Express   │                                    │
│  │              │                                    │
│  │  Port: 3000  │                                    │
│  └──────────────┘                                    │
│                                                      │
└──────────────────┬──────────────────────────────────┘
                   │ Tailscale
                   │
┌──────────────────▼──────────────────────────────────┐
│              SERVEUR OLLAMA / LiteLLM                │
│                                                      │
│  LiteLLM Proxy (OpenAI-compatible)                  │
│  Endpoint: http://<tailscale-ip>:4000/v1/...        │
│  Modèles: Gemma 4 (léger), Qwen3-14b, etc.         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Stack technique

### Backend
- **Node.js** + **Express**
- **better-sqlite3** pour la base de données
- **web-push** pour les notifications push
- **node-cron** pour les rappels planifiés
- **multer** pour l'upload de fichiers audio
- **axios** pour les appels HTTP vers LiteLLM et Faster-Whisper

### Frontend
- **React 18** avec Vite
- **Tailwind CSS** pour le styling
- PWA avec **Service Worker** pour les web push notifications
- **MediaRecorder API** pour l'enregistrement audio dans le browser
- Design mobile-first (usage principal sur Android)

### Services externes (réseau local Tailscale)
- **Faster-Whisper** : container Docker sur Unraid, expose une API REST sur le port 9000
- **LiteLLM** : proxy OpenAI-compatible sur le serveur Ollama distant

---

## Base de données SQLite — Schéma

```sql
-- Sessions de brain dump
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    raw_text TEXT,                    -- transcription brute (ou texte tapé)
    audio_file_path TEXT,            -- chemin vers le fichier audio original
    status TEXT DEFAULT 'processing' -- processing | transcribing | structuring | ready | validated
);

-- Tâches structurées par l'IA
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id),
    title TEXT NOT NULL,
    description TEXT,
    quadrant TEXT NOT NULL,          -- urgent_important | important_not_urgent | urgent_not_important | not_urgent_not_important
    is_ludic BOOLEAN DEFAULT 0,      -- tâche ludique ou non
    recurrence TEXT DEFAULT 'one_time', -- one_time | recurring
    status TEXT DEFAULT 'pending',   -- pending | active | completed | archived
    ai_suggested_quadrant TEXT,      -- classification originale de l'IA (avant validation)
    points_value INTEGER DEFAULT 10, -- points gagnés à la complétion
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historique des points
CREATE TABLE points_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    points INTEGER NOT NULL,
    action TEXT NOT NULL,             -- task_completed | ludic_unlocked
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rappels quotidiens envoyés
CREATE TABLE daily_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    suggested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reminder_count INTEGER DEFAULT 0, -- 0, 1, 2 (initial + 2 rappels)
    completed BOOLEAN DEFAULT 0,
    date TEXT NOT NULL                -- YYYY-MM-DD
);

-- Configuration / paramètres
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Souscriptions push
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Paramètres par défaut (table settings)

| Clé | Valeur par défaut | Description |
|-----|-------------------|-------------|
| `litellm_url` | `http://100.x.x.x:4000` | Endpoint LiteLLM |
| `litellm_model` | `gemma-4-light` | Modèle IA sélectionné |
| `whisper_url` | `http://localhost:9000` | Endpoint Faster-Whisper |
| `reminder_hour` | `08:00` | Heure du rappel quotidien |
| `reminder_interval_hours` | `5` | Intervalle entre rappels (heures) |
| `reminder_max_count` | `2` | Nombre de rappels supplémentaires |
| `points_per_task` | `10` | Points par tâche urgente+importante |
| `ludic_unlock_threshold` | `50` | Points nécessaires pour débloquer une tâche ludique |

---

## API Backend — Routes

### Brain Dump
```
POST   /api/dump/audio          — Upload audio, lance transcription async
POST   /api/dump/text           — Soumission texte, lance structuration async
GET    /api/dump/sessions       — Liste des sessions (avec pagination)
GET    /api/dump/sessions/:id   — Détail d'une session + tâches proposées
POST   /api/dump/sessions/:id/validate — Valider/ajuster les tâches d'une session
```

### Tâches
```
GET    /api/tasks               — Liste des tâches (filtres: quadrant, status, ludic)
PATCH  /api/tasks/:id           — Modifier une tâche (quadrant, titre, etc.)
POST   /api/tasks/:id/complete  — Marquer comme complétée (attribue les points)
DELETE /api/tasks/:id           — Supprimer/archiver une tâche
POST   /api/tasks               — Créer une tâche manuellement
```

### Points & Gamification
```
GET    /api/points/balance      — Points actuels + historique récent
GET    /api/points/can-unlock   — Vérifie si une tâche ludique peut être débloquée
POST   /api/points/unlock-ludic — Dépenser les points pour débloquer une tâche ludique
```

### Paramètres
```
GET    /api/settings            — Tous les paramètres
PATCH  /api/settings            — Mettre à jour un ou plusieurs paramètres
GET    /api/settings/models     — Proxy vers LiteLLM /v1/models (liste les modèles dispo)
```

### Push Notifications
```
POST   /api/push/subscribe      — Enregistrer une souscription push
GET    /api/push/vapid-key      — Récupérer la clé publique VAPID
```

---

## Flow détaillé — Brain Dump Audio

```
[Utilisateur]                [Backend]              [Faster-Whisper]        [LiteLLM]
     │                           │                        │                     │
     │── Appuie sur micro ──────>│                        │                     │
     │   (MediaRecorder API)     │                        │                     │
     │                           │                        │                     │
     │── Upload audio (.webm) ──>│                        │                     │
     │                           │── POST /transcribe ───>│                     │
     │                           │   (fichier audio)      │                     │
     │                           │<── Transcription ──────│                     │
     │                           │                        │                     │
     │                           │── POST /v1/chat/completions ──────────────>│
     │                           │   (prompt structuration)                    │
     │                           │<── Tâches structurées JSON ────────────────│
     │                           │                        │                     │
     │<── Web Push "Dump prêt" ──│                        │                     │
     │                           │                        │                     │
     │── GET /sessions/:id ─────>│                        │                     │
     │<── Tâches à valider ──────│                        │                     │
     │                           │                        │                     │
     │── POST /validate ────────>│                        │                     │
     │   (ajustements)           │                        │                     │
     │<── OK ────────────────────│                        │                     │
```

---

## Prompt IA — Structuration des pensées

Le prompt envoyé à LiteLLM pour structurer un brain dump :

```
Tu es un assistant de productivité spécialisé en gestion de tâches pour une personne avec un TDAH.

Tu reçois une transcription brute d'un brain dump audio en français québécois. Ton travail :

1. **Découper** le texte en tâches individuelles distinctes
2. **Reformuler** chaque tâche de façon claire et actionnable (verbe d'action + objet)
3. **Classifier** chaque tâche selon la matrice d'Eisenhower :
   - urgent_important : doit être fait aujourd'hui/demain, conséquences si pas fait
   - important_not_urgent : important mais peut être planifié
   - urgent_not_important : urgent mais pourrait être délégué ou simplifié
   - not_urgent_not_important : nice-to-have, peut être éliminé
4. **Identifier** les tâches ludiques (loisirs, plaisir, détente)

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{
  "tasks": [
    {
      "title": "Titre court et clair",
      "description": "Description plus détaillée si nécessaire",
      "quadrant": "urgent_important",
      "is_ludic": false,
      "reasoning": "Brève explication du classement"
    }
  ]
}

Transcription à traiter :
---
{{TRANSCRIPTION}}
---
```

---

## Frontend — Pages et composants

### 1. Page principale — Brain Dump
- **Gros bouton micro** central (Material-style FAB)
- Indicateur d'enregistrement en cours (waveform ou pulsation)
- Bouton stop → upload automatique
- Option texte (toggle pour taper au lieu de parler)
- Indicateur de statut : "Transcription en cours..." → "Structuration en cours..." → "Prêt !"

### 2. Page de validation — Session Review
- Liste les tâches proposées par l'IA
- Chaque tâche affiche : titre, description, quadrant suggéré, flag ludique
- **Drag & drop** ou dropdown pour changer le quadrant
- Toggle ludique / one-time vs récurrent
- Boutons : Valider tout / Supprimer / Modifier
- Badge montrant le "reasoning" de l'IA au tap

### 3. Page tâches — Eisenhower Board
- **Vue matrice 2x2** : les 4 quadrants avec les tâches actives
- Chaque tâche : checkbox pour compléter, titre, badge ludique si applicable
- Animation de célébration quand une tâche est complétée (+X points)
- Section "Tâche ludique débloquée !" quand le seuil est atteint

### 4. Page historique — Sessions
- Liste chronologique des sessions de brain dump
- Chaque session montre : date, nombre de tâches, statut
- Tap pour revoir le détail

### 5. Page paramètres — Settings
- URL LiteLLM
- Dropdown modèle IA (chargé dynamiquement via /v1/models)
- URL Faster-Whisper
- Heure du rappel quotidien (time picker)
- Intervalle des rappels de suivi
- Ratio de points / seuil ludique
- Test de connexion (ping LiteLLM + Whisper)
- Gestion des notifications push (activer/désactiver)

### 6. Barre de navigation
- Bottom nav (mobile-first) : Dump | Tâches | Sessions | Points | Settings
- Badge notification sur "Tâches" quand une session est prête à valider

---

## PWA & Service Worker

L'app doit être une **Progressive Web App** installable sur Android :

```json
// manifest.json
{
  "name": "ADHDHelper",
  "short_name": "ADHD",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#6366f1",
  "icons": [...]
}
```

Le service worker doit :
- Gérer les web push notifications
- Afficher les notifications même quand l'app est fermée
- Supporter les actions dans les notifications ("Voir la tâche", "Compléter")

---

## Cron Jobs (backend)

```javascript
// Rappel quotidien — heure configurable
cron.schedule(dynamicSchedule, async () => {
    // 1. Sélectionner UNE tâche urgent_important non complétée
    // 2. Créer une entrée daily_suggestions
    // 3. Envoyer web push "Ta tâche du jour : {titre}"
});

// Rappels de suivi — toutes les X heures (configurable)
cron.schedule('0 * * * *', async () => {
    // Vérifier les daily_suggestions du jour
    // Si pas complétée ET reminder_count < max
    // ET intervalle écoulé depuis dernier rappel
    // → Envoyer rappel push
    // → Incrémenter reminder_count
});
```

---

## Docker Compose

```yaml
version: '3.8'

services:
  adhdhelper:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data          # SQLite + fichiers audio
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/adhdhelper.db
      - AUDIO_PATH=/app/data/audio
      - VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}
      - VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
      - VAPID_EMAIL=${VAPID_EMAIL}
    restart: unless-stopped

  faster-whisper:
    image: fedirz/faster-whisper-server:latest
    ports:
      - "9000:8000"
    environment:
      - WHISPER__MODEL=medium
      - WHISPER__LANGUAGE=fr
      - WHISPER__DEVICE=cpu
    volumes:
      - whisper-models:/root/.cache/huggingface
    restart: unless-stopped

volumes:
  whisper-models:
```

---

## Design Direction

### Ton visuel
- **Dark theme** principal (slate-900/950)
- Accent **indigo/violet** pour les éléments interactifs
- Accents secondaires par quadrant Eisenhower :
  - urgent+important → **rouge/orange**
  - important pas urgent → **bleu**
  - urgent pas important → **jaune/ambre**
  - ni l'un ni l'autre → **gris**
- Typographie : une police display bold pour les titres, une sans-serif lisible pour le corps
- Animations subtiles mais satisfaisantes (complétion de tâche, gain de points)
- Mobile-first, gros éléments tactiles (bouton micro imposant)
- Visuellement encourageant, jamais anxiogène

### Inspiration TDAH-friendly
- Peu de texte, beaucoup de couleurs et d'indicateurs visuels
- Feedback immédiat (animations, sons optionnels)
- Pas de surcharge cognitive : une action principale par écran
- Progression visible (barre de points, streak si pertinent)

---

## Structure de fichiers attendue

```
adhdhelper/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env.example
├── server/
│   ├── index.js                 # Express app entry
│   ├── database.js              # SQLite init + helpers
│   ├── routes/
│   │   ├── dump.js              # Brain dump routes
│   │   ├── tasks.js             # Task CRUD
│   │   ├── points.js            # Points & gamification
│   │   ├── settings.js          # Settings routes
│   │   └── push.js              # Push notification routes
│   ├── services/
│   │   ├── whisper.js           # Faster-Whisper client
│   │   ├── llm.js               # LiteLLM client
│   │   ├── notification.js      # Web push service
│   │   └── scheduler.js         # Cron jobs
│   └── prompts/
│       └── structurer.js        # Prompt template IA
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.json
│   │   ├── sw.js                # Service worker
│   │   └── icons/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── pages/
│   │   │   ├── DumpPage.jsx
│   │   │   ├── ValidationPage.jsx
│   │   │   ├── TaskBoard.jsx
│   │   │   ├── SessionsPage.jsx
│   │   │   ├── PointsPage.jsx
│   │   │   └── SettingsPage.jsx
│   │   ├── components/
│   │   │   ├── AudioRecorder.jsx
│   │   │   ├── TaskCard.jsx
│   │   │   ├── EisenhowerMatrix.jsx
│   │   │   ├── PointsBar.jsx
│   │   │   ├── NavBar.jsx
│   │   │   └── NotificationBanner.jsx
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js
│   │   │   ├── usePushNotifications.js
│   │   │   └── useApi.js
│   │   └── styles/
│   │       └── tailwind.css
│   └── tailwind.config.js
└── README.md
```

---

## Notes importantes pour Claude Code

1. **L'app est PERSONNELLE** — un seul utilisateur, pas d'auth nécessaire
2. **Tout est async** — la transcription + structuration peuvent prendre 30-60 secondes. Le frontend doit gérer les états d'attente gracieusement.
3. **La validation est obligatoire** — l'IA propose, l'humain dispose. Jamais de tâches ajoutées automatiquement sans validation.
4. **Le français québécois** est la langue par défaut — interface en français, prompts en français.
5. **Tailscale only** — pas besoin de HTTPS custom, Tailscale gère. Mais le service worker pour les push requiert un contexte sécurisé (Tailscale MagicDNS fournit du HTTPS).
6. **Faster-Whisper** est un container séparé dans le même docker-compose. L'API est compatible OpenAI Whisper (`POST /v1/audio/transcriptions`).
7. **Les clés VAPID** pour le web push doivent être générées au premier lancement et stockées dans le .env.
8. **Le modèle IA est configurable** — le dropdown dans les settings charge dynamiquement la liste depuis `GET {litellm_url}/v1/models`.
9. **Responsive mobile-first** — l'usage principal est sur téléphone Android via le browser (PWA installée).
10. **SQLite database** dans un volume Docker monté pour la persistance.
