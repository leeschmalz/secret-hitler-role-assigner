import { sql } from '../../_db.js'
import { json, methodNotAllowed, readJson } from '../../_http.js'
import { buildRoleMessage, GAME_ID_RE } from '../../_game.js'

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
    const token = typeof body.token === 'string' ? body.token : ''

    if (!token) {
      return json(res, 400, { error: 'Missing player token.' })
    }

    const viewerRows = await sql`
      select name, role
      from players
      where game_id = ${gameId} and token = ${token}
    `

    if (!viewerRows.length) {
      return json(res, 403, { error: 'Player not found.' })
    }

    const players = await sql`
      select name, role
      from players
      where game_id = ${gameId}
      order by created_at
    `

    const message = buildRoleMessage(viewerRows[0].name, players)
    return json(res, 200, { message })
  } catch (error) {
    console.error('Reveal role failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
