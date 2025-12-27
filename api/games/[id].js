import { sql } from '../_db.js'
import { json, methodNotAllowed } from '../_http.js'
import { GAME_ID_RE, normalizeState } from '../_game.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const gameId = String(req.query.id || '').toLowerCase()
  if (!GAME_ID_RE.test(gameId)) {
    return json(res, 400, { error: 'Invalid game id.' })
  }

  try {
    const games = await sql`select id, state, round from games where id = ${gameId}`
    if (!games.length) {
      return json(res, 404, { error: 'Game not found.' })
    }

    const players = await sql`
      select name
      from players
      where game_id = ${gameId}
      order by created_at
    `

    const events = await sql`
      select id, message, created_at
      from events
      where game_id = ${gameId}
      order by created_at desc
      limit 6
    `

    const eventList = [...events]
      .reverse()
      .map((event) => ({
        id: event.id,
        message: event.message,
        createdAt: event.created_at,
      }))

    const game = games[0]
    return json(res, 200, {
      id: game.id,
      state: normalizeState(game.state),
      round: game.round,
      players: players.map((player) => player.name),
      playerCount: players.length,
      events: eventList,
    })
  } catch (error) {
    console.error('Fetch game failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
