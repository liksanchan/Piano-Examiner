# Deploy Piano Examiner online

| Guide | Best for |
|-------|----------|
| **[DEPLOY-RENDER.md](./DEPLOY-RENDER.md)** | **Recommended** — free, easy, no SSH (Render + Docker) |
| **[DEPLOY.md](./DEPLOY.md)** | Oracle Cloud free VM — always-on if you get capacity |

This file (`DEPLOY.md`) covers **Oracle Cloud**. If Oracle shows “out of capacity”, use **Render** instead.

---

# Deploy Piano Examiner on Oracle Cloud (free VM)

This guide runs the full app (Next.js + SQLite + Python AI) on an always-on Linux server using Docker.

---

## Oracle “out of capacity”?

If creating `VM.Standard.A1.Flex` fails with **Out of capacity**, try:

1. A different **Availability domain** (AD-2, AD-3)
2. Retry later (early morning often works)
3. **Use [DEPLOY-RENDER.md](./DEPLOY-RENDER.md) instead** — same Docker app, no VM needed

---

## Overview

| Component | Role |
|-----------|------|
| **app** container | Next.js + Python + ffmpeg |
| **caddy** container | Public HTTP/HTTPS reverse proxy |
| **piano-data** volume | SQLite database + uploaded audio |

---

## Part 1 — Deploy files (included in repo)

These files ship with the project:

- `Dockerfile`, `docker-compose.yml`, `Caddyfile`
- `scripts/docker-entrypoint.sh`
- `python/requirements-linux.txt`
- `.env.production.example`

Verify:

```bash
ls Dockerfile docker-compose.yml Caddyfile scripts/docker-entrypoint.sh
```

---

## Part 2 — Oracle Cloud VM

### 2.1 Create account

1. Go to [cloud.oracle.com](https://cloud.oracle.com) and sign up.
2. Complete verification (credit card required; stay in **Always Free** resources).

### 2.2 Create the VM

1. **Compute → Instances → Create instance**
2. **Name:** `piano-examiner`
3. **Image:** Ubuntu 22.04 or 24.04
4. **Shape:** `VM.Standard.A1.Flex` (Ampere, Always Free eligible)
   - Allocate at least **2 GB RAM** (12 GB if quota allows — evaluation is faster)

#### 5. Networking (public IP) — detailed

Scroll down to the **Networking** section on the Create instance page. This controls whether your VM is reachable from the internet.

**What you need:** a **public IPv4 address** so you can open `http://YOUR_IP` in a browser and SSH in from home.

**Step-by-step in the Oracle UI:**

1. **Primary VCN**
   - If this is your first VM, choose **Create new virtual cloud network (VCN)** — the defaults are fine.
   - If you already have a VCN, you can reuse it.

2. **Subnet**
   - Choose **Create new public subnet** (or pick an existing **public** subnet).
   - A **public** subnet is required. A private subnet will not give you internet access without extra setup.
   - If you see: **“You must select a public subnet to assign a public IPv4 address”** — see [Fix: public subnet warning](#fix-public-subnet-warning) below.

3. **Public IPv4 address** (most important)
   - Find **Public IPv4 address** (wording may be “Automatically assign public IPv4 address”).
   - Set it to **Assign a public IPv4 address** (must be **Yes** / enabled).
   - If this is off, the VM only gets a private IP and you cannot reach it from your phone or laptop.

4. **Leave the rest as defaults** unless you know you need something else:
   - **Private IPv4** — auto-assigned, no action needed
   - **IPv6** — optional, not required for this project

**After the VM is created — find your public IP:**

1. Go to **Compute → Instances**
2. Click your instance name (`piano-examiner`)
3. Under **Instance access** or **Primary VCN**, copy **Public IP address**
4. Test in a browser later: `http://THAT_IP` (once Docker is running)

**If you forgot to assign a public IP:**

1. Open the instance → **Attached VNICs** → click the VNIC name
2. **IPv4 Addresses → Edit**
3. Enable **Public IP** / assign ephemeral public IP  
   (Or create a new instance with public IP enabled — sometimes easier for beginners.)

```mermaid
flowchart LR
  internet[Your_phone_or_laptop] -->|HTTP_80_HTTPS_443| publicIP[Public_IPv4]
  publicIP --> vm[Ubuntu_VM]
  vm --> docker[Docker_Caddy_and_app]
```

**Networking checklist before you click Create:**

- [ ] Subnet is **public** (not private-only)
- [ ] **Assign public IPv4 address** is **Yes**
- [ ] You know which **region** you picked (e.g. UK London) — the IP lives there

#### Fix: public subnet warning

Oracle shows this when the subnet is **private** or not configured for internet access:

> **Warning — You must select a public subnet to assign a public IPv4 address.**

**Easiest fix (first VM — recommended):**

1. On the Create instance page, in **Networking**, under **Primary VCN**:
   - Select **Create new virtual cloud network (VCN)**
   - Oracle will create a VCN **with** an Internet Gateway and a **public** subnet automatically
2. Under **Subnet**, select **Create new public subnet** (not “private subnet”)
3. Now turn on **Assign a public IPv4 address** — the warning should disappear

**If you already chose an existing VCN:**

1. Under **Subnet**, open the dropdown
2. Look for a subnet whose name includes **public** (e.g. `public subnet-vcn-...`)
3. Do **not** pick one labeled **private**
4. If only private subnets exist, use **Create new public subnet** instead

**If the dropdown only shows private subnets (fix the VCN):**

1. Cancel instance creation (or open a new tab)
2. Go to **Networking → Virtual cloud networks**
3. Click your VCN → **Subnets → Create subnet**
4. Fill in:
   - **Name:** `public-subnet`
   - **Subnet type:** **Regional** (or Availability domain — either works)
   - **Subnet access:** **Public subnet** ← this is the key setting
   - **CIDR block:** e.g. `10.0.0.0/24` (must not overlap other subnets in the VCN)
5. Click **Create**
6. Go back to **Create instance** and select this new **public** subnet

**Also confirm the VCN has an Internet Gateway:**

1. **Networking → Virtual cloud networks → your VCN**
2. **Resources → Internet gateways** — there should be one in **Available** state
3. If missing: **Create internet gateway** → name it `internet-gateway` → Create
4. **Resources → Route tables** → open the **default** route table for your public subnet
5. **Route rules** should include:
   - **Destination:** `0.0.0.0/0`
   - **Target:** your Internet Gateway  
   Without this rule, even a “public” subnet cannot reach the internet.

**Quick rule:** Public subnet + Internet Gateway + route `0.0.0.0/0` → Internet Gateway = public IP works.

---

#### 6. SSH keys — beginner guide

##### What is this for?

After your VM is created, you need a way to **log into it from your Windows PC** and run commands (install Docker, start the app, etc.).

Oracle does **not** give you a simple password for Ubuntu VMs. Instead you use **SSH keys**:

- **Private key** — stays on **your PC only** (like a house key). Never share it or paste it into Oracle.
- **Public key** — safe to give to Oracle (like a lock that only your key opens). You paste this when creating the VM.

When you connect, your PC proves it has the matching private key, and Oracle lets you in.

##### What is PowerShell?

**PowerShell** is a command window built into Windows — a place to type text commands instead of clicking buttons.

**How to open it:**

1. Press the **Windows key** on your keyboard (or click Start)
2. Type **`PowerShell`**
3. Click **Windows PowerShell** (or **Terminal** — either works)

A window with a prompt like `PS C:\Users\User>` opens. That is where you paste the commands below.

**Tip:** You can also open PowerShell inside Cursor: **Terminal → New Terminal** (often PowerShell by default on Windows).

##### Step A — Generate your key pair (one-time, ~1 minute)

In PowerShell, type this and press **Enter**:

```powershell
ssh-keygen -t ed25519 -C "piano-examiner"
```

PowerShell will ask three questions:

1. **`Enter file in which to save the key (C:\Users\User/.ssh/id_ed25519)`**  
   → Press **Enter only** — do **not** type a name or description here.  
   If you type text (e.g. “SSH public key for oracle”), the key is saved in the **wrong folder** with that filename and Step B will fail.

2. **`Enter passphrase (empty for no passphrase):`**  
   → Press **Enter** for none (simplest), or type a password if you want extra security

3. **`Enter same passphrase again:`**  
   → Press **Enter** again (or re-type your passphrase)

You should see something like “Your identification has been saved” and a little “randomart” picture. That means it worked.

**Where the files went:**

| File | Location | Use |
|------|----------|-----|
| Private key | `C:\Users\YourName\.ssh\id_ed25519` | Stays on your PC — **never paste into Oracle** |
| Public key | `C:\Users\YourName\.ssh\id_ed25519.pub` | Paste into Oracle |

The `.ssh` folder is hidden in your user folder. You do not need to open it manually — the next command prints the public key for you.

##### Step B — Copy your public key

In the same PowerShell window, run:

```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

**If you see “Cannot find path … id_ed25519.pub”** — you probably typed a custom name in Step A instead of pressing Enter. Your key may be in your current folder instead. Try:

```powershell
Get-Content ".\SSH public key for oracle.pub"
```

(or whatever filename `ssh-keygen` reported after “Your public key has been saved in …”)

**Better fix:** run Step A again and press **Enter** at the file path prompt so the key goes to the default `.ssh` folder.

**What this does:** displays the public key text in the window.

You should see **one long line** starting with:

```
ssh-ed25519 AAAA...lots of letters and numbers... piano-examiner
```

**Select and copy the entire line** (Ctrl+C):

- Start at `ssh-ed25519`
- Include everything through `piano-examiner` at the end
- It must be **one line**, not multiple lines

##### Step C — Paste into Oracle

Back on the **Create instance** page in your browser:

1. Scroll down to **Add SSH keys**
2. Select **Paste public keys** (not “Generate a key pair for me” unless you want Oracle to email you a key file)
3. Click in the text box and **paste** (Ctrl+V) the line you copied
4. Double-check:
   - Line starts with `ssh-ed25519`
   - You pasted the **`.pub`** content (the output of Step B), not something from a file without `.pub`

##### Step D — Connect after the VM is running

When your instance shows **Running** (green), copy its **Public IP address** from the Oracle instance page.

In PowerShell:

```powershell
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

Replace `YOUR_VM_PUBLIC_IP` with the real IP, e.g.:

```powershell
ssh ubuntu@123.45.67.89
```

**Important:** the username is **`ubuntu`** (because you chose an Ubuntu image).

First time only, you may see:

```
Are you sure you want to continue connecting (yes/no)?
```

Type **`yes`** and press Enter.

If it works, your prompt changes to something like:

```
ubuntu@piano-examiner:~$
```

You are now **inside the cloud server**. Commands you type here run on the VM, not on your PC.

To exit later, type **`exit`** and press Enter.

##### Common mistakes

| Mistake | What to do |
|---------|------------|
| Pasted private key instead of public | Only paste output from `id_ed25519.pub` (Step B) |
| Only copied part of the key line | Copy the **whole** line from `ssh-ed25519` to the end |
| Used wrong username | Use `ubuntu@`, not `root@` or your Oracle email |
| “ssh is not recognized” | Windows 10/11 usually has SSH built in; try opening a **new** PowerShell window, or install “OpenSSH Client” in Windows Optional Features |
| Created VM without pasting a key | Terminate that VM and create a new one with the key in Step C |

##### If SSH fails

| Error | Likely cause | Fix |
|-------|----------------|-----|
| `Connection timed out` | Public IP missing, or port 22 blocked | Check networking (section 5) and firewall (section 2.3) |
| `Permission denied (publickey)` | Wrong key pasted, or wrong username | Re-do Step B and C; use `ubuntu@` |
| `Network unreachable` | Wrong IP copied | Copy Public IP again from Oracle instance page |

##### If you already created the VM without an SSH key

You cannot easily log in. Easiest fix: **terminate** that instance and create a new one with your public key pasted in Step C.

7. Click **Create** and wait until the instance state is **Running** (green)

### 2.3 Open firewall ports (networking part 2)

Creating the VM is not enough — Oracle’s **virtual firewall** must allow traffic in. There are two places people get stuck; configure **both**.

#### A) VCN Security List (subnet firewall)

This is the main one. Port 22/80/443 are blocked by default.

1. On your **Instance details** page, under **Primary VCN**, click the **Subnet** link  
   (or go to **Networking → Virtual cloud networks → your VCN → Subnets → your subnet**)
2. Click the **Security list** name (often `Default Security List for ...`)
3. Click **Add ingress rules** and add these three rules (one at a time, or all if the UI allows):

| Source CIDR | IP Protocol | Destination port | Description |
|-------------|-------------|------------------|-------------|
| `0.0.0.0/0` | TCP | 22 | SSH |
| `0.0.0.0/0` | TCP | 80 | HTTP (website) |
| `0.0.0.0/0` | TCP | 443 | HTTPS |

- **Source CIDR `0.0.0.0/0`** = allow from anywhere on the internet  
- For slightly better security on SSH, you can use **your home IP**/32 instead of `0.0.0.0/0` for port 22 only (find it at [whatismyip.com](https://whatismyip.com))

4. Click **Add ingress rules** / **Save**

#### B) Ubuntu firewall on the VM (usually OK by default)

Oracle Ubuntu images often allow everything until you enable `ufw`. After you SSH in, you can check:

```bash
sudo ufw status
```

If it says **inactive**, you do not need to change anything.  
If you later enable `ufw`, allow the same ports:

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

#### C) Instance “ingress” vs Security List

Some Oracle docs mention **instance-level** rules. For most free-tier setups, editing the **Security List** (section A) is enough. If the site still does not load after Docker is running:

1. Instance details → **Primary VCN** → confirm **Public IP** is shown
2. Re-check Security List has rules for **80** and **443**
3. On the VM: `docker compose ps` — both `app` and `caddy` should be **Up**
4. On the VM: `curl -I http://localhost` — should return HTTP headers from Caddy

**Quick test from your PC (after deploy):**

```powershell
# Replace with your public IP
curl http://YOUR_VM_PUBLIC_IP
```

You should get HTML back once the app is running.

### 2.4 SSH in

```bash
ssh ubuntu@YOUR_VM_PUBLIC_IP
```

---

## Part 3 — Install Docker on the VM

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER
```

Log out and SSH back in so the `docker` group applies.

Verify:

```bash
docker --version
docker compose version
```

---

## Part 4 — Get the code on the VM

### Option A — GitHub (recommended)

On your PC, push to a **private** GitHub repo (never commit `.env.local` or `data/`).

On the VM:

```bash
git clone https://github.com/YOUR_USER/ai-piano-examiner.git
cd ai-piano-examiner
```

### Option B — Copy from PC

```bash
# From your PC (PowerShell):
scp -r "C:\Users\User\OneDrive\Documents\Cursor projects\ai-piano-examiner" ubuntu@YOUR_VM_IP:~/ai-piano-examiner
```

Exclude `node_modules`, `.next`, and `data` when copying.

---

## Part 5 — Configure and start

```bash
cd ~/ai-piano-examiner
cp .env.production.example .env
nano .env
```

Set at minimum:

- `SESSION_SECRET` — random 32+ character string
- `GEMINI_API_KEY` — your Google AI key (for written feedback)

Build and start:

```bash
docker compose up -d --build
```

First build takes 10–20 minutes (npm + Python ML packages).

Check logs:

```bash
docker compose logs -f app
```

Wait for: `Starting Piano Examiner on port 3000`

---

## Part 6 — Test

Open in a browser:

```
http://YOUR_VM_PUBLIC_IP
```

You should see the login page. Sign up, add a song, record, and submit an evaluation.

**Note:** Microphone access in browsers usually requires **HTTPS**. For full mobile recording, complete Part 7.

---

## Part 7 — HTTPS with a custom domain

1. Buy or use a domain (Cloudflare, Namecheap, etc.).
2. Add an **A record** pointing to your VM public IP.
3. Edit `Caddyfile` — comment out the `:80` block and uncomment the domain block:

```
piano.yourdomain.com {
    reverse_proxy app:3000
}
```

4. Restart Caddy:

```bash
docker compose restart caddy
```

Caddy obtains a free Let's Encrypt certificate automatically.

---

## Part 8 — Smoke test from your phone

On cellular (not home Wi‑Fi):

- [ ] Load `https://piano.yourdomain.com`
- [ ] Sign up / log in
- [ ] Upload reference audio
- [ ] Record or upload practice take
- [ ] Submit for examiner feedback

---

## Maintenance

### Update after code changes

```bash
cd ~/ai-piano-examiner
git pull
docker compose up -d --build
```

### Backup data

```bash
docker compose exec app tar -czf /tmp/backup.tar.gz -C /app data
docker cp $(docker compose ps -q app):/tmp/backup.tar.gz ./backup-$(date +%F).tar.gz
```

Download `backup-*.tar.gz` to your PC periodically.

### View logs

```bash
docker compose logs -f app
docker compose logs -f caddy
```

### Stop / start

```bash
docker compose down
docker compose up -d
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on pip | Check `docker compose logs app`; ARM may need more RAM |
| Evaluation fails | `docker compose exec app python3 python/evaluate.py --help` |
| Site not reachable | Check Oracle security list ports 80/443 |
| 502 from Caddy | `docker compose ps` — app container must be running |
| Mic blocked on phone | Use HTTPS + domain (Part 7) |

### Shell into the app container

```bash
docker compose exec app bash
python3 python/evaluate.py --reference /path --student /path
```

---

## Deploy file templates

Create these files in the project root if they do not exist yet.

### `Dockerfile`

```dockerfile
FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN pip3 install --no-cache-dir --break-system-packages -r python/requirements-linux.txt

RUN chmod +x scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=./data/piano-examiner.db
ENV UPLOAD_DIR=./data/uploads
ENV PYTHON_PATH=python3
ENV EVALUATION_MODE=auto

EXPOSE 3000

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
```

### `docker-compose.yml`

```yaml
services:
  app:
    build: .
    env_file: .env
    volumes:
      - piano-data:/app/data
    restart: unless-stopped
    networks:
      - web

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - web

volumes:
  piano-data:
  caddy-data:
  caddy-config:

networks:
  web:
```

### `Caddyfile`

```
:80 {
    reverse_proxy app:3000
}

# HTTPS — uncomment when you have a domain:
# piano.yourdomain.com {
#     reverse_proxy app:3000
# }
```

### `scripts/docker-entrypoint.sh`

```sh
#!/bin/sh
set -e

node scripts/prepare-data-dirs.mjs

echo "Applying database schema…"
npx drizzle-kit push

echo "Starting Piano Examiner on port ${PORT:-3000}…"
exec npm start
```

### `python/requirements-linux.txt`

```
onnxruntime
numpy<2
pretty_midi
pydub
librosa
soundfile
mir-eval
resampy<0.4.3
scikit-learn
scipy
typing-extensions
setuptools<81
basic-pitch --no-deps
```

### `.env.production.example`

```
SESSION_SECRET=change-me-to-a-random-string-at-least-32-chars
DATABASE_PATH=./data/piano-examiner.db
UPLOAD_DIR=./data/uploads
EVALUATION_MODE=auto
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
PYTHON_PATH=python3
```

### `.dockerignore`

```
node_modules
.next
data
.git
.env*
!.env.production.example
*.db
coverage
out
build
```

### `.gitignore` addition

Add this line so the production env example can be committed:

```
!.env.production.example
```
