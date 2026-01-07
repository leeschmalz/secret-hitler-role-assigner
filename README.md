# Secret Hitler Role Assigner

A web replacement for the [SMS role assigner](https://github.com/leeschmalz/SecretHitler-SMS-Role-Assigner), for the popular board game Secret Hitler. Use it at https://sh.leeschmalz.com.

Minimal React + Vite app with Vercel serverless functions and Neon Postgres.

## Setup

1. Create a Neon Postgres database.
2. Run the schema in `db/schema.sql`.
3. Set `DATABASE_URL` in Vercel (and locally if using `vercel dev`).

## Local development

Use dev mode to show the god controls menu, let's you add many players and see their roles without having multiple devices.
```
DEV_MODE=true vercel dev
```
