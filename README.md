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
