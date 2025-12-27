import { sql } from '../../_db.js'
import { json, methodNotAllowed } from '../../_http.js'
import { GAME_ID_RE, MAX_PLAYERS, MIN_PLAYERS, canAddPlayers } from '../../_game.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const gameId = String(req.query.id || '').toLowerCase()
  if (!GAME_ID_RE.test(gameId)) {
    return json(res, 400, { error: 'Invalid game id.' })
  }

  try {
    const games = await sql`select state from games where id = ${gameId}`
    if (!games.length) {
      return json(res, 404, { error: 'Game not found.' })
    }

    if (!canAddPlayers(games[0].state)) {
      return json(res, 400, { error: 'Game already started.' })
    }

    const countRows = await sql`
      select count(*)::int as count
      from players
      where game_id = ${gameId}
    `

    const count = countRows[0].count
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
      return json(res, 400, { error: `Need ${MIN_PLAYERS}-${MAX_PLAYERS} players to start.` })
    }

    await sql`
      update games
      set state = 'active', updated_at = now()
      where id = ${gameId}
    `

    return json(res, 200, { state: 'active' })
  } catch (error) {
    console.error('Start game failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
