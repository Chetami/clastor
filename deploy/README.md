# Deployment (cPanel / Verpex)

Two PowerShell scripts deploy the frontend (static Vite build) and backend
(Node.js via cPanel "Setup Node.js App" / Phusion Passenger).

```
deploy_frontend.ps1   builds + uploads frontend/dist  -> tms-dev.xamify.com.au
deploy_backend.ps1    builds + bundles + uploads backend -> tms-dev-backend.xamify.com.au (Passenger)
deploy/config.ps1              shared host/paths/auth helpers (edit once)
deploy/app.js                  Passenger entry point (Application startup file)
deploy/frontend.env.production prod Vite env (committed - public client keys only)
deploy/backend.env.production  prod backend env (git-IGNORED - secrets live here)
deploy/backend.env.production.example   template (committed)
```

---

## One-time setup

### 1. cPanel Node.js app (backend)
In cPanel -> **Setup Node.js App**:
- **Node.js version**: 20.x
- **Application root**: `/home/xamify/tms-dev-backend.xamify.com.au`
- **Application startup file**: `app.js`
- **Application mode**: Production

Click **Create** / **Save**. (The first deploy uploads `app.js`.)

### 2. Google OAuth (production callback)
Google Cloud Console -> APIs & Services -> Credentials -> your OAuth client ->
**Authorized redirect URIs**, add:
```
https://tms-dev-backend.xamify.com.au/api/auth/google/callback
```

### 3. Production env files
```powershell
# Frontend: already committed with public values. Edit only if URLs change.
notepad deploy/frontend.env.production

# Backend: create from template and fill the secrets (this file is git-ignored)
copy deploy\backend.env.production.example deploy\backend.env.production
notepad deploy\backend.env.production     # set JWT_SECRET, GOOGLE_OAUTH_CLIENT_SECRET, SMTP_PASS
```

### 4. SSH access (local)
You can use **either** a password or an SSH key (key is easier + required for CI).

- **Password** (default): install `sshpass` once to avoid per-command prompts:
  ```powershell
  scoop install sshpass
  ```
- **Key** (recommended): generate a key and add the public half to cPanel
  (`~/.ssh/authorized_keys`), then pass `-IdentityFile path\to\key`.

---

## Deploy from your machine

```powershell
# Backend (also builds interfaces first)
.\deploy_backend.ps1 -Password "your-cpanel-password"
#   or:  .\deploy_backend.ps1 -IdentityFile $HOME\.ssh\id_ed25519

# Frontend
.\deploy_frontend.ps1 -Password "your-cpanel-password"

# Dry run (build + stage only, no upload)
.\deploy_backend.ps1 -DryRun
```

If `sshpass` is not installed, you'll be prompted for the password on each
SSH/SCP call (functional, just repetitive).

---

## Deploy from GitHub Actions

The workflow `.github/workflows/deploy.yml` deploys **both** packages on push to
`main` or `deployment` (and via manual **Run workflow**). It uses an **SSH key**
(password auth cannot be used in CI).

### Generate a deploy-only key
```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
# paste deploy_key.pub into cPanel ~/.ssh/authorized_keys
```

### Repository secrets (Settings -> Secrets and variables -> Actions -> Secrets)
| Secret | Value |
|---|---|
| `CPANEL_SSH_HOST` | `xamify.com.au` |
| `CPANEL_SSH_USER` | `xamify` |
| `CPANEL_SSH_KEY`  | full contents of `deploy_key` (private key PEM) |
| `JWT_SECRET` | production JWT secret |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |
| `SMTP_PASS` | SMTP password for `noreply@xamify.com.au` |
| `FIREBASE_SERVICE_ACCOUNT_B64` | base64 of the Firebase service-account JSON (see below) |

### Repository variables (Secrets and variables -> Actions -> Variables)
Optional - the workflow has sensible defaults. Override only if different:
`FRONTEND_REMOTE`, `BACKEND_REMOTE`, `FRONTEND_URL`, `BACKEND_URL`,
`VITE_API_URL`, `VITE_FIREBASE_*`, `CORS_ORIGIN`, `FRONTEND_URL`,
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_REDIRECT_URI`, `SMTP_*`, `EMAIL_FROM`.

### Encode the Firebase key for the secret
```bash
base64 -w0 firebase-service-account.json   # linux/mac
# or on Windows PowerShell:
[Convert]::ToBase64String([IO.File]::ReadAllBytes("firebase-service-account.json"))
```
Paste the output into the `FIREBASE_SERVICE_ACCOUNT_B64` secret.

---

## What each deploy does

**Frontend:** build `interfaces` -> `npm install` + `vite build` (with prod env) ->
`scp` `dist/*` to the subdomain root -> fix permissions (755/644).

**Backend:** build `interfaces` + `backend` -> stage `dist/`, `app.js`, `.env`,
`firebase-service-account.json`, and a `package.json` with the type-only
`@examify-tms/interfaces` dep removed -> tar -> upload -> remote `npm install --omit=dev`
-> `touch tmp/restart.txt` (reload Passenger) -> `GET /health`.

---

## Troubleshooting
- **Backend 502 / app not starting**: in cPanel open the Node app's **Run NPM Install**
  and check the app log. Verify `app.js` is the startup file and `dist/server.js` exists.
- **Health check fails right after deploy**: Passenger can take a few seconds to spin up;
  retry `curl https://tms-dev-backend.xamify.com.au/health`.
- **CORS errors in browser**: confirm `CORS_ORIGIN` in the deployed `.env` matches the
  frontend origin exactly (scheme + host, no trailing slash).
- **`scp: ambiguous target`**: ensure remote paths are quoted (the scripts handle this).
