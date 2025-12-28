import { sql } from '../_db.js'
import { json, methodNotAllowed } from '../_http.js'
import { randomGameId } from '../_game.js'

const getRequestId = (req) => req.headers['x-vercel-id'] || req.headers['x-request-id'] || ''

// Cleanup threshold in minutes (default: 7 days = 10080 minutes)
const CLEANUP_MINUTES = Number(process.env.GAME_CLEANUP_MINUTES) || 10080

// Delete games older than the configured threshold and their associated data
const cleanupOldGames = async (requestId) => {
  console.info('[games] cleanup check', { requestId, CLEANUP_MINUTES })

  try {
    // Find games older than the configured threshold
    const oldGames = await sql`
      select id, created_at from games
      where created_at < now() - interval '1 minute' * ${CLEANUP_MINUTES}
    `

    console.info('[games] cleanup query result', {
      requestId,
      found: oldGames.length,
      games: oldGames.map((g) => ({ id: g.id, created_at: g.created_at })),
    })

    if (!oldGames.length) {
      return
    }

    const oldGameIds = oldGames.map((g) => g.id)
    console.info('[games] cleanup starting', { requestId, count: oldGameIds.length, ids: oldGameIds })

    // Delete associated data first, then the games
    await sql`delete from players where game_id = any(${oldGameIds})`
    await sql`delete from events where game_id = any(${oldGameIds})`
    await sql`delete from games where id = any(${oldGameIds})`

    console.info('[games] cleanup complete', { requestId, deleted: oldGameIds.length })
  } catch (error) {
    // Log but don't throw - cleanup is best-effort
    console.error('[games] cleanup failed', { requestId, message: error?.message, stack: error?.stack })
  }
}

const createGame = async (requestId) => {
  let attempt = 0

  while (attempt < 6) {
    const gameId = randomGameId()
    try {
      await sql`insert into games (id, state, round) values (${gameId}, 'add_players', 0)`
      return gameId
    } catch (error) {
      if (error?.code === '23505') {
        attempt += 1
        console.warn('[games] create collision', { requestId, gameId, attempt })
        continue
      }
      throw error
    }
  }

  return null
}

export default async function handler(req, res) {
  const requestId = getRequestId(req)
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  console.info('[games] create request', {
    requestId,
    method: req.method,
    url: req.url,
    env: process.env.VERCEL_ENV || '',
    region: process.env.VERCEL_REGION || '',
  })

  try {
    const gameId = await createGame(requestId)
    if (!gameId) {
      console.error('[games] create exhausted attempts', { requestId })
      return json(res, 500, { error: 'Could not create game.' })
    }
    console.info('[games] create success', { requestId, gameId })

    // Run cleanup (awaited for debugging - can be made non-blocking later)
    await cleanupOldGames(requestId)

    return json(res, 201, { id: gameId })
  } catch (error) {
    console.error('Create game failed', {
      requestId,
      message: error?.message,
      stack: error?.stack,
    })
    return json(res, 500, { error: 'Server error.' })
  }
}
