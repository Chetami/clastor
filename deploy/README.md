# Deployment (cPanel / Verpex) — multi-environment

The deploy scripts target a **named environment** (`dev`, `staging`, `prod`, …).
Each environment is its own Firebase project, its own cPanel subdomains, and its
own set of config files under `deploy/environments/`.

```
deploy_backend.ps1     builds + bundles + uploads backend -> <env backend URL> (Passenger)
deploy_frontend.ps1    builds + uploads frontend/dist   -> <env frontend URL>
deploy/deploy.ps1      dispatcher: -Component backend|frontend|both
deploy/new-environment.ps1   scaffolds a NEW environment in one shot
deploy/config.ps1      shared SSH/auth helpers + host config (sshUser/sshHost/nodeEnable)
deploy/app.js          Passenger entry point (Application startup file)

deploy/environments/<env>.psd1          env definition (name, URLs, remote paths) — COMMITTED
deploy/environments/<env>/              per-env secrets — GIT-IGNORED
    backend.env                         backend env (JWT, SMTP, Stripe, OAuth...)
    frontend.env                        Vite env (VITE_API_URL, VITE_FIREBASE_*)
    firebase-service-account.json       Firebase Admin key
    FIREBASE_SETUP.md                   generated Firebase-console checklist
deploy/templates/                       committed templates the bootstrap copies from
    backend.env.example
    frontend.env.example
    FIREBASE_SETUP.md
```

---

## Adding a new environment (e.g. `staging`)

You set up the cPanel side first, then run one script that builds everything else.

1. **In cPanel**, create the two subdomains/domains (e.g. `tms-staging.xamify.com.au`
   and `tms-staging-backend.xamify.com.au`) and a Node.js app for the backend
   (see *One-time cPanel setup* below). Note the document roots — cPanel usually
   uses `/home/<user>/<subdomain>`.

2. **Scaffold the environment** (URLs + remote paths are fully custom per env):
   ```powershell
   .\deploy\new-environment.ps1 `
       -Name staging `
       -FrontendUrl "https://tms-staging.xamify.com.au" `
       -BackendUrl  "https://tms-staging-backend.xamify.com.au" `
       -FrontendRemote "/home/xamify/tms-staging.xamify.com.au" `
       -BackendRemote  "/home/xamify/tms-staging-backend.xamify.com.au" `
       -From dev          # copies shared secrets (SMTP, Stripe, OAuth, JWT) from dev
   ```
   This writes `deploy/environments/staging.psd1`, fills every URL-derived value
   (`CORS_ORIGIN`, `VITE_API_URL`, redirect URI, …), copies over the shared
   secrets, and writes `deploy/environments/staging/FIREBASE_SETUP.md`.

3. **Finish the Firebase bits by hand** — follow
   `deploy/environments/staging/FIREBASE_SETUP.md` (create the project, register
   the web app, paste the config into `frontend.env`, drop the service-account
   JSON in place).

4. **Deploy:**
   ```powershell
   .\deploy.ps1 -Environment staging -Component both -IdentityFile $HOME\.ssh\id_ed25519
   ```

Re-running `new-environment.ps1` with an existing `-Name` fails unless you pass
`-Force`.

---

## One-time cPanel setup (per environment backend)

In cPanel -> **Setup Node.js App** (one per environment):
- **Node.js version**: 20.x
- **Application root**: the env's backend remote path (e.g. `/home/xamify/tms-staging-backend.xamify.com.au`)
- **Application startup file**: `app.js`
- **Application mode**: Production

Click **Create** / **Save**. (The first deploy uploads `app.js`.)

## Google OAuth (per environment)

Google Cloud Console -> APIs & Services -> Credentials -> your OAuth client ->
**Authorized redirect URIs**, add this env's callback:
```
https://<env backend URL>/api/auth/google/callback
```
(The exact URI is derived and shown in `FIREBASE_SETUP.md`.)

## SSH access (local)

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
# A specific environment (always pass -Environment)
.\deploy_backend.ps1  -Environment dev -IdentityFile $HOME\.ssh\id_ed25519
.\deploy_frontend.ps1 -Environment dev -IdentityFile $HOME\.ssh\id_ed25519

# Or use the dispatcher for both at once
.\deploy\deploy.ps1 -Environment dev -Component both -IdentityFile $HOME\.ssh\id_ed25519

# Dry run (build + stage only, no upload)
.\deploy_backend.ps1 -Environment dev -DryRun
```

If `sshpass` is not installed and you use `-Password`, you'll be prompted for the
password on each SSH/SCP call (functional, just repetitive).

---

## What each deploy does

**Frontend:** build `interfaces` -> `npm install` + `vite build` (with the env's
`frontend.env` injected as `.env.production`) -> `scp` `dist/*` to the env's
subdomain root -> fix permissions (755/644).

**Backend:** build `interfaces` + `backend` -> stage `dist/`, `app.js`, `.env`,
`firebase-service-account.json`, and a `package.json` with the type-only
`@examify-tms/interfaces` dep removed -> tar -> upload -> remote
`npm install --omit=dev` -> `touch tmp/restart.txt` (reload Passenger) ->
`GET <env backend URL>/health`.

---

## Troubleshooting
- **`Unknown environment 'X'`**: no `deploy/environments/X.psd1`. Run
  `deploy/new-environment.ps1 -Name X ...` to create it.
- **`still contains REPLACE_WITH_ placeholder values`**: the env's `backend.env`
  has an unfilled secret (JWT, SMTP, Stripe, OAuth…). Fill it in, or re-run
  `new-environment.ps1 -From dev` to copy shared secrets over.
- **Backend 502 / app not starting**: in cPanel open the Node app's **Run NPM
  Install** and check the app log. Verify `app.js` is the startup file and
  `dist/server.js` exists.
- **Health check fails right after deploy**: Passenger can take a few seconds to
  spin up; retry `curl https://<env backend URL>/health`.
- **CORS errors in browser**: confirm `CORS_ORIGIN` in the deployed `.env` matches
  the frontend origin exactly (scheme + host, no trailing slash).
- **`scp: ambiguous target`**: ensure remote paths are quoted (the scripts handle this).
