<p align="center">
  <img src="https://github.com/user-attachments/assets/862e86e5-15c4-45c8-a94f-599c6632ed29" alt="image">
</p>

# Secret Hitler Role Assigner

A web replacement for the [SMS role assigner](https://github.com/leeschmalz/SecretHitler-SMS-Role-Assigner), for the popular board game Secret Hitler. Use it at https://sh.leeschmalz.com.

The game is typically played by passing out brown envelopes with cards inside that describe the hidden identity of each player. The players then look at their roles privately, all players close their eyes, and someone instructs the Fascist players to open their eyes or raise their hand to share the necessary pre-game information. This project solves two slight inconveniences with the standard role assignment process:
1. The eye closing and opening process gets tedious and annoying when playing many rounds.
2. The brown envelopes are made out of paper and inevitably get creased or wet in memorable ways, making it harder to keep roles a secret, and often requiring players to hide their envelope.

This application handles all role management. Each player joins a shared session that allows them to see their own role, see their teammates roles when applicable, and use presidential powers.

## Setup

1. Create a Neon Postgres database.
2. Run the schema in `db/schema.sql`.
3. Set `DATABASE_URL` in Vercel (and locally if using `vercel dev`).

## Local development

Use dev mode to show the god controls menu, let's you add many players and see their roles without having multiple devices.
```
DEV_MODE=true vercel dev
```
