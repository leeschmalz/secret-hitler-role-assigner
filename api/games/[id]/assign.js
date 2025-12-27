import { sql } from '../../_db.js'
import { json, methodNotAllowed } from '../../_http.js'
import { GAME_ID_RE, generateRoles, randomId } from '../../_game.js'

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

    if (games[0].state !== 'active') {
      return json(res, 400, { error: 'Start the game before assigning roles.' })
    }

    const players = await sql`
      select id, name
      from players
      where game_id = ${gameId}
      order by created_at
    `

    const roles = generateRoles(players.length)
    if (!roles.length || roles.length !== players.length) {
      return json(res, 400, { error: 'This player count is not supported.' })
    }

    const updates = players.map((player, index) =>
      sql`
        update players
        set role = ${roles[index]}, updated_at = now()
        where id = ${player.id}
      `
    )

    await Promise.all(updates)

    const rounds = await sql`
      update games
      set round = round + 1, updated_at = now()
      where id = ${gameId}
      returning round
    `

    const round = rounds[0]?.round ?? 0
    await sql`
      insert into events (id, game_id, message)
      values (${randomId()}, ${gameId}, ${`Round ${round}: roles assigned.`})
    `

    return json(res, 200, { round })
  } catch (error) {
    console.error('Assign roles failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
