import { sql } from '../../_db.js'
import { json, methodNotAllowed, readJson } from '../../_http.js'
import {
  GAME_ID_RE,
  MAX_PLAYERS,
  canAddPlayers,
  nameKey,
  normalizeName,
  randomId,
  randomToken,
} from '../../_game.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST'])
  }

  const gameId = String(req.query.id || '').toLowerCase()
  if (!GAME_ID_RE.test(gameId)) {
    return json(res, 400, { error: 'Invalid game id.' })
  }

  try {
    const body = await readJson(req)
    const rawName = typeof body.name === 'string' ? body.name : ''
    const name = normalizeName(rawName)

    if (!name) {
      return json(res, 400, { error: 'Enter a player name.' })
    }

    if (name.length > 24) {
      return json(res, 400, { error: 'Name is too long.' })
    }

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

    if (countRows[0].count >= MAX_PLAYERS) {
      return json(res, 400, { error: 'Game already has 10 players.' })
    }

    const token = randomToken()
    const playerId = randomId()

    try {
      await sql`
        insert into players (id, game_id, name, name_key, role, token)
        values (${playerId}, ${gameId}, ${name}, ${nameKey(name)}, '', ${token})
      `
    } catch (error) {
      if (error?.code === '23505') {
        return json(res, 409, { error: 'Name already taken.' })
      }
      throw error
    }

    return json(res, 201, { name, token })
  } catch (error) {
    console.error('Join failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
