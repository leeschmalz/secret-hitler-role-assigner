import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 2500

const DevPanel = ({ gameId, onPlayersAdded }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [devMode, setDevMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [playerCount, setPlayerCount] = useState(5)
  const [allRoles, setAllRoles] = useState(null)
  const lastGameId = useRef(gameId)

  // Check if dev mode is enabled on the server
  useEffect(() => {
    const checkDevMode = async () => {
      try {
        const res = await fetch('/api/dev/status')
        const data = await res.json()
        setDevMode(data.devMode === true)
      } catch (err) {
        console.warn('Dev mode check failed:', err)
        setDevMode(false)
      } finally {
        setLoading(false)
      }
    }
    checkDevMode()
  }, [])

  // Clear roles when gameId changes
  useEffect(() => {
    if (gameId !== lastGameId.current) {
      setAllRoles(null)
      lastGameId.current = gameId
    }
  }, [gameId])

  // Auto-poll roles when they're being displayed
  useEffect(() => {
    if (!allRoles || !gameId || !isOpen) return

    const pollRoles = async () => {
      try {
        const res = await fetch('/api/dev/all-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId }),
        })
        const data = await res.json()
        if (res.ok) {
          setAllRoles(data)
        }
      } catch (err) {
        // Silently fail on poll errors
      }
    }

    const interval = setInterval(pollRoles, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [allRoles, gameId, isOpen])

  // Don't render anything if not in dev mode
  if (loading || !devMode) {
    return null
  }

  const addFakePlayers = async () => {
    if (!gameId) {
      setMessage('Join a game first')
      return
    }

    setBusy('adding')
    setMessage('')
    try {
      const res = await fetch('/api/dev/add-players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, count: playerCount }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Failed to add players')
      } else {
        setMessage(`Added ${data.added.length} player(s): ${data.added.map((p) => p.name).join(', ')}`)
        if (onPlayersAdded) onPlayersAdded()
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy('')
    }
  }

  const fetchAllRoles = async () => {
    if (!gameId) {
      setMessage('Join a game first')
      return
    }

    setBusy('roles')
    setMessage('')
    try {
      const res = await fetch('/api/dev/all-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Failed to fetch roles')
        setAllRoles(null)
      } else {
        setAllRoles(data)
      }
    } catch (err) {
      setMessage(err.message)
      setAllRoles(null)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        className="dev-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Dev Panel"
      >
        🛠️
      </button>

      {/* Dev Panel */}
      {isOpen && (
        <div className="dev-panel">
          <div className="dev-panel-header">
            <h3>Dev Mode</h3>
            <button className="dev-close" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="dev-panel-content">
            {gameId ? (
              <p className="dev-game-id">Game: <code>{gameId}</code></p>
            ) : (
              <p className="dev-warning">Create or join a game first</p>
            )}

            {/* Add fake players section */}
            <div className="dev-section">
              <label className="dev-label">Add fake players</label>
              <div className="dev-row">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Number(e.target.value))}
                  className="dev-input"
                />
                <button
                  className="dev-btn"
                  onClick={addFakePlayers}
                  disabled={busy === 'adding' || !gameId}
                >
                  {busy === 'adding' ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            {/* View all roles section */}
            <div className="dev-section">
              <label className="dev-label">View all roles (god mode)</label>
              <button
                className="dev-btn full"
                onClick={fetchAllRoles}
                disabled={busy === 'roles' || !gameId}
              >
                {busy === 'roles' ? 'Loading...' : 'Show All Roles'}
              </button>
              
              {allRoles && (
                <div className="dev-roles">
                  <p className="dev-roles-header">
                    Round {allRoles.round} • {allRoles.state}
                  </p>
                  <ul className="dev-roles-list">
                    {allRoles.players.map((p) => (
                      <li key={p.name} className={`dev-role-item ${p.role}`}>
                        <span className="dev-role-name">{p.name}</span>
                        <span className={`dev-role-badge ${p.role}`}>{p.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {message && <p className="dev-message">{message}</p>}
          </div>
        </div>
      )}
    </>
  )
}

export default DevPanel

