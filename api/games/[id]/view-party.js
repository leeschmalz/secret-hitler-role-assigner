import { sql } from '../../_db.js'
import { json, methodNotAllowed, readJson } from '../../_http.js'
import { GAME_ID_RE, getParty, nameKey, randomId } from '../../_game.js'

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
    const rawTarget = typeof body.targetName === 'string' ? body.targetName : ''
    const targetKey = nameKey(rawTarget)

    if (!token) {
      return json(res, 400, { error: 'Missing player token.' })
    }

    if (!targetKey) {
      return json(res, 400, { error: 'Select a player to view.' })
    }

    const viewerRows = await sql`
      select name
      from players
      where game_id = ${gameId} and token = ${token}
    `

    if (!viewerRows.length) {
      return json(res, 403, { error: 'Player not found.' })
    }

    const targetRows = await sql`
      select name, role
      from players
      where game_id = ${gameId} and name_key = ${targetKey}
    `

    if (!targetRows.length) {
      return json(res, 404, { error: 'Player not found.' })
    }

    const target = targetRows[0]
    if (!target.role) {
      return json(res, 400, { error: 'Roles are not assigned yet.' })
    }

    const party = getParty(target.role)
    await sql`
      insert into events (id, game_id, message)
      values (${randomId()}, ${gameId}, ${`${target.name}'s party membership was viewed.`})
    `

    return json(res, 200, { name: target.name, party })
  } catch (error) {
    console.error('View party failed', error)
    return json(res, 500, { error: 'Server error.' })
  }
}
