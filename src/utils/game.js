/**
 * Normalize game data from API response.
 * Ensures arrays and counts are properly initialized.
 */
export const normalizeGame = (data) => {
  if (!data || typeof data !== 'object') {
    return null
  }

  const players = Array.isArray(data.players) ? data.players : []
  const events = Array.isArray(data.events) ? data.events : []
  const playerCount = Number.isFinite(data.playerCount) ? data.playerCount : players.length

  return {
    ...data,
    players,
    events,
    playerCount,
  }
}

/**
 * Get CSS class for role-based styling.
 */
export const getRoleClass = (message) => {
  if (!message) return ''
  const lower = message.toLowerCase()
  if (lower.includes('liberal')) return 'liberal'
  if (lower.includes('hitler')) return 'hitler'
  if (lower.includes('fascist')) return 'fascist'
  return ''
}

