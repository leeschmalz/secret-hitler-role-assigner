const STORAGE_PREFIX = 'shra'

/**
 * Get stored player data for a game from localStorage.
 */
export const getStoredPlayer = (gameId) => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${gameId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Store player data for a game in localStorage.
 */
export const setStoredPlayer = (gameId, player) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(`${STORAGE_PREFIX}:${gameId}`, JSON.stringify(player))
}

/**
 * Remove stored player data for a game from localStorage.
 */
export const clearStoredPlayer = (gameId) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(`${STORAGE_PREFIX}:${gameId}`)
}

