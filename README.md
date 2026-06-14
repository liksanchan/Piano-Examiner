# AI Piano Examiner

An AI-powered piano performance examiner. Run locally or deploy online with Docker (Render or Oracle Cloud).

Upload sheet music, record yourself playing, and receive structured feedback in ABRSM or Trinity grading modes.

## Tech stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS
- **Database:** SQLite (local file via libsql)
- **File storage:** Local filesystem (`data/uploads/`)
- **Auth:** Email + password with signed session cookies

## Getting started

### 1. Install dependencies

```powershell
cd ai-piano-examiner
npm install
```

### 2. Configure environment

```powershell
copy .env.local.example .env.local
```

Edit `.env.local` and set `SESSION_SECRET` to a random string of at least 32 characters.

### 3. Create the database

```powershell
npm run db:push
```

This creates `data/piano-examiner.db` with all required tables.

### 4. Run the app

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local data

All data is stored on disk:

| Path | Contents |
|---|---|
| `data/piano-examiner.db` | SQLite database (users, sheet music, performances) |
| `data/uploads/` | Uploaded PDFs, JPEGs, and audio recordings |

To reset everything, stop the dev server and delete the `data/` folder, then run `npm run db:push` again.

## Deploy online (free)

| Guide | When to use |
|-------|-------------|
| **[DEPLOY-RENDER.md](./DEPLOY-RENDER.md)** | **Start here** — Render free tier, GitHub + Docker, no SSH |
| **[DEPLOY.md](./DEPLOY.md)** | Oracle Cloud VM — if you get free Ampere capacity |

```bash
docker compose up -d --build   # Oracle / own Linux server only
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run db:push` | Apply schema to SQLite |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |
| `npm run build` | Production build |
| `docker compose up -d --build` | Production deploy on Oracle / own Linux server (see DEPLOY.md) |

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/       # signup, login, logout
│   │   ├── evaluate/   # placeholder AI judge
│   │   └── files/      # authenticated file serving
│   ├── dashboard/
│   ├── login/
│   └── signup/
├── components/
│   ├── auth/
│   └── layout/
└── lib/
    ├── auth/           # session, password hashing
    ├── db/             # Drizzle schema + SQLite connection
    └── storage/        # local filesystem helpers
```

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Create account and sign in |
| `/api/auth/login` | POST | Sign in |
| `/api/auth/logout` | POST | Sign out |
| `/api/evaluate` | POST | AI evaluation (Basic Pitch + Essentia + Gemini) |
| `/api/files/[...path]` | GET | Serve user files (auth required) |

## AI evaluation pipeline

When `EVALUATION_MODE=auto` (default), submitting a performance runs:

1. **Spotify Basic Pitch** — transcribes reference + student audio to MIDI
2. **Essentia** (or librosa on Windows) — tempo/dynamics analysis on audio; Essentia pitch-contour similarity on MIDI where available
3. **MIDI comparison** — note accuracy, timing error, missing/extra notes
4. **Google Gemini** — writes ABRSM/Trinity feedback from the metrics (falls back to rule-based scoring if Gemini fails)

### Setup

1. Install **Python 3.10+** and **ffmpeg** (required for WebM/MP3 conversion).
2. Install Python dependencies:

```powershell
npm run python:setup
# or: pip install -r python/requirements.txt
```

3. Add to `.env.local`:

```env
EVALUATION_MODE=auto
GEMINI_API_KEY=your-key-from-google-ai-studio
PYTHON_PATH=python
```

Set `EVALUATION_MODE=mock` to use placeholder scores without Python/Gemini.

Analysis can take several minutes per submission (Basic Pitch is CPU-heavy).

## Next steps

- Cloud hosting if you want access beyond your laptop

## Using the app

1. **Sign up** and open the **Dashboard**
2. **Upload** a PDF or JPEG of your sheet music
3. Click **Practice** on a piece to open the recording studio
4. Choose **ABRSM** or **Trinity** mode and evaluation criteria
5. **Record** your performance, then **Submit for examiner feedback**
6. View your results, **download a PDF report**, or **share to WhatsApp**
