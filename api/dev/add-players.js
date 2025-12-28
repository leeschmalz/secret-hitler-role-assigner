import { sql } from '../_db.js'
import { json, methodNotAllowed, readJson } from '../_http.js'
import {
  GAME_ID_RE,
  MAX_PLAYERS,
  canAddPlayers,
  nameKey,
  normalizeName,
  randomId,
  randomToken,
} from '../_game.js'

const FAKE_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
]

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
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 10)

    if (!GAME_ID_RE.test(gameId)) {
      return json(res, 400, { error: 'Invalid game id.' })
    }

    const games = await sql`select state from games where id = ${gameId}`
    if (!games.length) {
      return json(res, 404, { error: 'Game not found.' })
    }

    if (!canAddPlayers(games[0].state)) {
      return json(res, 400, { error: 'Game already started.' })
    }

    // Get current player count
    const countRows = await sql`
      select count(*)::int as count
      from players
      where game_id = ${gameId}
    `
    const currentCount = countRows[0].count

    // Get existing player names to avoid duplicates
    const existingPlayers = await sql`
      select name_key from players where game_id = ${gameId}
    `
    const existingKeys = new Set(existingPlayers.map((p) => p.name_key))

    // Calculate how many we can add
    const slotsAvailable = MAX_PLAYERS - currentCount
    const toAdd = Math.min(count, slotsAvailable)

    if (toAdd <= 0) {
      return json(res, 400, { error: 'Game is already full.' })
    }

    // Find available fake names
    const availableNames = FAKE_NAMES.filter((n) => !existingKeys.has(nameKey(n)))
    
    // If we need more names than available, generate numbered ones
    let nameIndex = 0
    const addedPlayers = []

    for (let i = 0; i < toAdd; i++) {
      let name
      if (nameIndex < availableNames.length) {
        name = availableNames[nameIndex]
        nameIndex++
      } else {
        // Generate a numbered name
        let num = 1
        do {
          name = `Player${num}`
          num++
        } while (existingKeys.has(nameKey(name)))
      }

      const token = randomToken()
      const playerId = randomId()

      await sql`
        insert into players (id, game_id, name, name_key, role, token)
        values (${playerId}, ${gameId}, ${name}, ${nameKey(name)}, '', ${token})
      `

      existingKeys.add(nameKey(name))
      addedPlayers.push({ name, token })
    }

    return json(res, 201, { added: addedPlayers })
  } catch (error) {
    console.error('Dev add-players failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}

