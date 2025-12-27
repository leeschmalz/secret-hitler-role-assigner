import { sql } from '../_db.js'
import { json, methodNotAllowed } from '../_http.js'
import { GAME_ID_RE, normalizeState } from '../_game.js'

const getRequestId = (req) => req.headers['x-vercel-id'] || req.headers['x-request-id'] || ''

export default async function handler(req, res) {
  const requestId = getRequestId(req)
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET'])
  }

  const rawId = req.query.id
  const gameId = String(rawId || '').toLowerCase()
  if (!GAME_ID_RE.test(gameId)) {
    console.warn('[games] fetch invalid id', {
      requestId,
      rawId,
      gameId,
      url: req.url,
    })
    return json(res, 400, { error: 'Invalid game id.' })
  }

  console.info('[games] fetch request', {
    requestId,
    gameId,
    url: req.url,
    env: process.env.VERCEL_ENV || '',
    region: process.env.VERCEL_REGION || '',
  })

  try {
    const games = await sql`select id, state, round from games where id = ${gameId}`
    if (!games.length) {
      console.warn('[games] fetch not found', { requestId, gameId })
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
    const normalizedState = normalizeState(game.state)
    console.info('[games] fetch success', {
      requestId,
      gameId,
      state: game.state,
      normalizedState,
      round: game.round,
      playerCount: players.length,
      eventCount: events.length,
    })
    return json(res, 200, {
      id: game.id,
      state: normalizedState,
      round: game.round,
      players: players.map((player) => player.name),
      playerCount: players.length,
      events: eventList,
    })
  } catch (error) {
    console.error('Fetch game failed', {
      requestId,
      gameId,
      message: error?.message,
      stack: error?.stack,
    })
    return json(res, 500, { error: 'Server error.' })
  }
}
