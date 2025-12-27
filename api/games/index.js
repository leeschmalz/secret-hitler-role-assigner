import { sql } from '../_db.js'
import { json, methodNotAllowed } from '../_http.js'
import { randomGameId } from '../_game.js'

const createGame = async () => {
  let attempt = 0

  while (attempt < 6) {
    const gameId = randomGameId()
    try {
      await sql`insert into games (id, state, round) values (${gameId}, 'add_players', 0)`
      return gameId
    } catch (error) {
      if (error?.code === '23505') {
        attempt += 1
        continue
      }
      throw error
    }
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  try {
    const gameId = await createGame()
    if (!gameId) {
      return json(res, 500, { error: 'Could not create game.' })
    }
    return json(res, 201, { id: gameId })
  } catch (error) {
    console.error('Create game failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
