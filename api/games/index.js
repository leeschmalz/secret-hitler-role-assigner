import { sql } from '../_db.js'
import { json, methodNotAllowed } from '../_http.js'
import { randomGameId } from '../_game.js'

const getRequestId = (req) => req.headers['x-vercel-id'] || req.headers['x-request-id'] || ''

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
