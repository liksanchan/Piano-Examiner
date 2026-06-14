# Deploy Piano Examiner on Render (free tier)

**Recommended** if Oracle Cloud has no free VM capacity. Render runs your existing Docker app — no Vercel/Supabase rewrite needed.

**Website:** [https://render.com](https://render.com)

---

## What you get

| Item | Detail |
|------|--------|
| Cost | **$0** on the free plan |
| URL | `https://your-app-name.onrender.com` (HTTPS included) |
| Full AI pipeline | Yes — Python + Basic Pitch inside Docker |
| Always on? | **No** — free tier **sleeps after ~15 min** idle; first visit may take 30–60s to wake |
| Data persistence | **Ephemeral on free** — uploads/DB may be **lost on redeploy**; fine for testing |

---

## Before you start

You need:

1. A **GitHub account** — [https://github.com](https://github.com)
2. Your project code pushed to a **private** GitHub repo
3. A **Gemini API key** (optional but recommended for written feedback)
4. A random **session secret** (32+ characters)

---

## Part 1 — Push code to GitHub

### 1.1 Create a private repo

1. Go to [https://github.com/new](https://github.com/new)
2. Name: `piano-examiner`
3. Visibility: **Private**
4. Do **not** add README (you already have one)
5. Click **Create repository**

### 1.2 Push from your PC

Open **PowerShell** in your project folder (the folder name on your PC may differ from the GitHub repo name):

```powershell
cd "C:\Users\User\OneDrive\Documents\Cursor projects\ai-piano-examiner"

git init
git add .
git status
```

Confirm `.env.local` and `data/` are **not** listed (they are in `.gitignore`).

```powershell
git commit -m "Initial commit — piano examiner app"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/piano-examiner.git
git push -u origin main
```

Sign in to GitHub if prompted.

---

## Part 2 — Create a Render account

1. Go to [https://render.com](https://render.com)
2. Click **Get Started for Free**
3. Sign up with **GitHub** (easiest — connects repos automatically)

---

## Part 3 — Create the web service

1. In the Render dashboard, click **New +** → **Web Service**
2. Connect your GitHub account if asked
3. Select the **`piano-examiner`** repository
4. Configure:

| Setting | Value |
|---------|--------|
| **Name** | `piano-examiner` (this becomes part of your URL) |
| **Region** | Pick closest to you (e.g. Frankfurt for UK) |
| **Branch** | `main` |
| **Runtime** | **Docker** |
| **Instance type** | **Free** |

Leave **Build Command** and **Start Command** empty — Render uses your `Dockerfile` automatically.

5. Scroll to **Environment variables** — add:

| Key | Value |
|-----|--------|
| `SESSION_SECRET` | A long random string (32+ chars), e.g. generate at [https://generate-secret.vercel.app/32](https://generate-secret.vercel.app/32) |
| `GEMINI_API_KEY` | Your Google AI key (leave blank to use rule-based scoring only) |
| `EVALUATION_MODE` | `auto` |
| `PYTHON_PATH` | `python3` |
| `DATABASE_PATH` | `./data/piano-examiner.db` |
| `UPLOAD_DIR` | `./data/uploads` |
| `NODE_ENV` | `production` |

Render also sets `PORT` automatically — do not override it.

6. Click **Create Web Service**

---

## Part 4 — Wait for the build

The first deploy takes **15–25 minutes** (npm install + Python ML packages).

Watch the **Logs** tab. Success looks like:

```
Applying database schema…
Starting Piano Examiner on port 10000…
```

When status shows **Live**, click your URL: `https://piano-examiner.onrender.com`

---

## Part 5 — Test the app

1. Open your Render URL in a browser (wait if the service was sleeping)
2. **Sign up** for an account
3. **Add a song** — upload or record reference audio
4. **Practice** — record or upload a performance
5. **Submit for feedback** — confirms Python evaluation works

**From your phone:** use the same HTTPS URL. Microphone needs HTTPS — Render provides that automatically.

---

## Free tier limitations

### Sleep / cold start

After ~15 minutes with no visitors, Render stops the service. The next visitor waits **30–60 seconds** while it wakes up.

**Workaround:** upgrade to a paid instance ($7/mo) for always-on, or use [Cloudflare Tunnel + home PC](./DEPLOY.md) for zero cost when your PC is on.

### Memory (512 MB)

AI evaluation is heavy. On free tier, long recordings may fail with out-of-memory errors.

**Tips:**

- Use shorter recordings while testing
- If logs show out-of-memory errors, upgrade to **Standard** (2 GB RAM) or use shorter audio

### Data loss on redeploy

On the free plan, files in `data/` (SQLite + audio) live on **ephemeral disk**. A **new deploy** can wipe them.

**For serious use:** add a [Render persistent disk](https://render.com/docs/disks) (paid) or migrate storage later.

---

## Updating the app

After you change code locally:

```powershell
git add .
git commit -m "Describe your change"
git push
```

Render auto-deploys from GitHub. Watch the **Logs** tab for the new build.

---

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Build fails on pip/npm | Open **Logs** → scroll to the error. Common fix: `basic-pitch --no-deps` cannot go inside `requirements-linux.txt` — see **Build error: basic-pitch --no-deps** below |
| `502 Bad Gateway` | Service still starting — wait 1–2 min after deploy |
| Very slow first load | Free tier waking from sleep — normal |
| Evaluation fails | Check logs for Python errors; confirm `GEMINI_API_KEY` if using Gemini |
| Sign up works but songs vanish | Redeploy wiped ephemeral data — re-upload, or add persistent disk |
| `Invalid session` | `SESSION_SECRET` changed between deploys — log in again |

### View logs

Render dashboard → your service → **Logs**

### Manual redeploy

**Manual Deploy** → **Deploy latest commit**

### Build error: `Invalid requirement: basic-pitch --no-deps`

If logs show:

```
ERROR: Invalid requirement: basic-pitch --no-deps
pip3: error: no such option: --no-deps
```

`--no-deps` is a **pip command flag**, not valid inside a requirements file. Fix in your repo, push to GitHub, and redeploy:

**1. Edit `python/requirements-linux.txt`** — remove the last line `basic-pitch --no-deps`

**2. Edit `Dockerfile`** — change the pip line to two steps:

```dockerfile
RUN pip3 install --no-cache-dir --break-system-packages -r python/requirements-linux.txt \
  && pip3 install --no-cache-dir --break-system-packages basic-pitch --no-deps
```

**3. Commit and push:**

```powershell
git add python/requirements-linux.txt Dockerfile
git commit -m "Fix Render build: install basic-pitch separately"
git push
```

Render will auto-rebuild.

---

## Optional: one-click Blueprint

Create a file named `render.yaml` in the project root (or use **New + → Web Service** manually — Part 3 above is easier for first deploy):

```yaml
services:
  - type: web
    name: piano-examiner
    runtime: docker
    plan: free
    healthCheckPath: /login
    envVars:
      - key: NODE_ENV
        value: production
      - key: HOSTNAME
        value: 0.0.0.0
      - key: DATABASE_PATH
        value: ./data/piano-examiner.db
      - key: UPLOAD_DIR
        value: ./data/uploads
      - key: EVALUATION_MODE
        value: auto
      - key: PYTHON_PATH
        value: python3
      - key: SESSION_SECRET
        generateValue: true
      - key: GEMINI_API_KEY
        sync: false
      - key: GEMINI_MODEL
        value: gemini-2.0-flash
```

To use Blueprint:

1. Render dashboard → **New +** → **Blueprint**
2. Connect the GitHub repo
3. Set `GEMINI_API_KEY` in the dashboard after deploy

---

## Compare: Render vs Oracle VM

| | **Render (this guide)** | **Oracle VM ([DEPLOY.md](./DEPLOY.md))** |
|--|-------------------------|------------------------------------------|
| Setup difficulty | Easier — no SSH | Harder — SSH, firewall, Docker |
| Cost | $0 free tier | $0 if capacity available |
| Always on | No (free) | Yes |
| Oracle capacity issues | N/A | Often “out of capacity” |

---

## Next steps

- **Custom domain:** Render dashboard → Settings → Custom Domains
- **Always on:** upgrade instance type
- **Persistent data:** add Render disk or plan Supabase Storage migration later
