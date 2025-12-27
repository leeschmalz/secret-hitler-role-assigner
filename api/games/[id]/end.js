import { sql } from '../../_db.js'
import { json, methodNotAllowed } from '../../_http.js'
import { GAME_ID_RE } from '../../_game.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const gameId = String(req.query.id || '').toLowerCase()
  if (!GAME_ID_RE.test(gameId)) {
    return json(res, 400, { error: 'Invalid game id.' })
  }

  try {
    const games = await sql`select id from games where id = ${gameId}`
    if (!games.length) {
      return json(res, 404, { error: 'Game not found.' })
    }

    await sql`delete from players where game_id = ${gameId}`
    await sql`delete from events where game_id = ${gameId}`
    await sql`
      update games
      set state = 'add_players', round = 0, updated_at = now()
      where id = ${gameId}
    `

    return json(res, 200, { state: 'add_players' })
  } catch (error) {
    console.error('End game failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
