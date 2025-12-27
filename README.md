# Secret Hitler Role Assigner (Web)

Minimal React + Vite app with Vercel serverless functions and Neon Postgres.

## Setup

1. Create a Neon Postgres database.
2. Run the schema in `db/schema.sql`.
3. Set `DATABASE_URL` in Vercel (and locally if using `vercel dev`).

## Local development

```bash
npm install
npm run dev
```

The frontend uses `/api` for game actions. For local API testing, use `vercel dev`.

• Got it. If you already have psql, you just need a running Postgres server, a DB, and DATABASE_URL.

  Commands (use your existing Postgres)

  createdb secret_hitler
  psql secret_hitler -f db/schema.sql

  .env.local

  cat > .env.local <<'EOF'
  DATABASE_URL=postgres://localhost:5432/secret_hitler
  EOF

  Run local app + API

  npx vercel dev