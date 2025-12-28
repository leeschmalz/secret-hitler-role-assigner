import { sql } from '../_db.js'
import { json, methodNotAllowed, readJson } from '../_http.js'
import { GAME_ID_RE } from '../_game.js'

export default async function handler(req, res) {
  // Only allow in development mode
  if (process.env.DEV_MODE !== 'true') {
    return json(res, 403, { error: 'Dev mode is not enabled.' })
  }

  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  try {
    const body = await readJson(req)
    const gameId = String(body.gameId || '').toLowerCase()

    if (!GAME_ID_RE.test(gameId)) {
      return json(res, 400, { error: 'Invalid game id.' })
    }

    const games = await sql`select state, round from games where id = ${gameId}`
    if (!games.length) {
      return json(res, 404, { error: 'Game not found.' })
    }

    const players = await sql`
      select name, role from players
      where game_id = ${gameId}
      order by created_at
    `

    return json(res, 200, {
      state: games[0].state,
      round: games[0].round,
      players: players.map((p) => ({
        name: p.name,
        role: p.role || '(not assigned)',
      })),
    })
  } catch (error) {
    console.error('Dev all-roles failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}

