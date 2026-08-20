# Deployment

This project's deployment scripts (cPanel/Verpex-based) and environment
definitions are maintained in a **private infrastructure repository** and are
not part of this open-source repo.

To deploy your own instance:

1. Provision a host (any Node.js-capable Linux host works).
2. Build the packages (`npm run build:all` from the repo root).
3. Serve `frontend/dist` as static files and run `backend/dist/server.js`
   behind a process manager / reverse proxy of your choice.
4. Configure the environment variables listed in
   [`backend/.env.example`](../backend/.env.example) and
   [`frontend/.env.example`](../frontend/.env.example)
   (Firebase service account, Stripe keys, SMTP, etc.).
