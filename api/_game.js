import { randomBytes, randomUUID } from 'node:crypto'

export const MIN_PLAYERS = 5
export const MAX_PLAYERS = 10
export const GAME_ID_RE = /^[a-z]{5}$/

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const ROLE_MAP = {
  5: ['liberal', 'liberal', 'liberal', 'fascist', 'hitler'],
  6: ['liberal', 'liberal', 'liberal', 'liberal', 'fascist', 'hitler'],
  7: ['liberal', 'liberal', 'liberal', 'liberal', 'fascist', 'fascist', 'hitler'],
  8: ['liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'fascist', 'fascist', 'hitler'],
  9: ['liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'fascist', 'fascist', 'fascist', 'hitler'],
  10: ['liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'liberal', 'fascist', 'fascist', 'fascist', 'hitler'],
}

const shuffle = (items) => {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export const generateRoles = (count) => {
  const roles = ROLE_MAP[count]
  if (!roles) {
    return []
  }
  return shuffle(roles)
}

export const getParty = (role) => (role === 'liberal' ? 'liberal' : 'fascist')

export const normalizeName = (name) => name.trim().replace(/\s+/g, ' ')

export const nameKey = (name) => normalizeName(name).toLowerCase()

export const randomGameId = () => {
  const bytes = randomBytes(5)
  let value = ''
  for (let i = 0; i < 5; i += 1) {
    value += LETTERS[bytes[i] % LETTERS.length]
  }
  return value
}

export const randomToken = () => randomBytes(16).toString('hex')

export const randomId = () => randomUUID()

export const buildRoleMessage = (playerName, players) => {
  const player = players.find((entry) => entry.name === playerName)
  if (!player || !player.role) {
    return 'Roles are not assigned yet.'
  }

  const totalPlayers = players.length
  const role = player.role
  const hitlerKnowsTeam = totalPlayers <= 6

  if (role === 'liberal' || (role === 'hitler' && !hitlerKnowsTeam)) {
    return `Your role is ${role}.`
  }

  const fascists = players.filter((entry) => entry.role && entry.role !== 'liberal')
  const others = fascists.filter((entry) => entry.name !== playerName)
  const list = others.map((entry) => `(${entry.name} is ${entry.role})`).join(' ')
  const suffix = list ? ` Fascists are: ${list}` : ' Fascists are: (none)'

  return `Your role is ${role}.${suffix}`
}
