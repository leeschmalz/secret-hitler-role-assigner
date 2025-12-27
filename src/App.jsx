import { useEffect, useMemo, useState } from 'react'

const MIN_PLAYERS = 5
const MAX_PLAYERS = 10
const GAME_ID_RE = /^[a-z]{5}$/
const POLL_INTERVAL = 2500

const request = async (path, options = {}) => {
  const shouldLog = (() => {
    if (typeof window === 'undefined') {
      return false
    }
    if (import.meta?.env?.DEV) {
      return true
    }
    let storageDebug = false
    try {
      storageDebug = window.localStorage.getItem('shra:debug') === 'true'
    } catch (error) {
      storageDebug = false
    }
    return storageDebug || new URLSearchParams(window.location.search).has('debug')
  })()
  if (shouldLog) {
    console.info('[api] request', {
      path,
      method: options.method || 'GET',
    })
  }

  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  let payload = {}
  try {
    payload = await response.json()
  } catch (error) {
    payload = {}
  }

  if (shouldLog) {
    console.info('[api] response', {
      path,
      status: response.status,
      ok: response.ok,
      payload,
    })
  }

  if (!response.ok) {
    if (shouldLog) {
      console.error('[api] error', { path, status: response.status, payload })
    }
    throw new Error(payload.error || 'Request failed.')
  }

  return payload
}

const useRoute = () => {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  const navigate = (to) => {
    window.history.pushState({}, '', to)
    setPath(to)
  }

  return { path, navigate }
}

const normalizeGame = (data) => {
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

const getStoredPlayer = (gameId) => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(`shra:${gameId}`)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

const setStoredPlayer = (gameId, player) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(`shra:${gameId}`, JSON.stringify(player))
}

const clearStoredPlayer = (gameId) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(`shra:${gameId}`)
}

const Home = ({ navigate }) => {
  const [gameId, setGameId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await request('/api/games', { method: 'POST' })
      navigate(`/g/${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = (event) => {
    event.preventDefault()
    const cleaned = gameId.trim().toLowerCase()
    if (!GAME_ID_RE.test(cleaned)) {
      setError('Enter a valid 5-letter game id.')
      return
    }
    navigate(`/g/${cleaned}`)
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Secret Hitler</p>
        <h1>Role Assigner</h1>
        <p className="lead">
          Spin up a shared game, pass the id around, and handle roles without
          cards.
        </p>
      </header>

      <section className="grid">
        <div className="card">
          <h2>Create game</h2>
          <p className="muted">Start a new session and share the id.</p>
          <button className="btn large" type="button" onClick={handleCreate} disabled={busy}>
            {busy ? 'Creating…' : 'Create game'}
          </button>
        </div>

        <div className="card">
          <h2>Join game</h2>
          <p className="muted">Enter a 5-letter id to jump in.</p>
          <form className="row" onSubmit={handleJoin}>
            <input
              type="text"
              value={gameId}
              onChange={(event) => setGameId(event.target.value)}
              placeholder="e.g. kqznd"
              aria-label="Game id"
            />
            <button className="btn large" type="submit">
              Join
            </button>
          </form>
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}
    </div>
  )
}

const Game = ({ gameId, navigate }) => {
  const [game, setGame] = useState(null)
  const [player, setPlayer] = useState(() => getStoredPlayer(gameId))
  const [nameInput, setNameInput] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [revealMessage, setRevealMessage] = useState('')
  const [lastRevealRound, setLastRevealRound] = useState(0)
  const [viewTarget, setViewTarget] = useState('')
  const [viewResult, setViewResult] = useState(null)

  useEffect(() => {
    setPlayer(getStoredPlayer(gameId))
    setNameInput('')
    setRevealMessage('')
    setLastRevealRound(0)
    setViewResult(null)
    setNotice('')
    setError('')
    setLoading(true)
  }, [gameId])

  useEffect(() => {
    let active = true

    const loadGame = async (initial = false) => {
      if (initial) {
        setLoading(true)
      }
      try {
        const data = await request(`/api/games/${gameId}`)
        if (active) {
          const nextGame = normalizeGame(data)
          if (!nextGame) {
            setError('Invalid game data.')
            return
          }
          setGame(nextGame)
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(err.message)
        }
      } finally {
        if (active && initial) {
          setLoading(false)
        }
      }
    }

    loadGame(true)
    const interval = setInterval(() => loadGame(false), POLL_INTERVAL)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [gameId])

  const refreshGame = async () => {
    const data = await request(`/api/games/${gameId}`)
    const nextGame = normalizeGame(data)
    if (!nextGame) {
      throw new Error('Invalid game data.')
    }
    setGame(nextGame)
  }

  useEffect(() => {
    if (!game?.players?.length) {
      setViewTarget('')
      return
    }

    if (!game.players.includes(viewTarget)) {
      setViewTarget(game.players[0])
    }
  }, [game, viewTarget])

  useEffect(() => {
    if (!player || !game?.players) {
      return
    }

    const stillInGame = game.players.some(
      (playerName) => playerName.toLowerCase() === player.name.toLowerCase()
    )
    if (!stillInGame) {
      clearStoredPlayer(gameId)
      setPlayer(null)
      setNotice('Join again to participate in this game.')
      setRevealMessage('')
      setViewResult(null)
      setLastRevealRound(0)
    }
  }, [game, player, gameId])

  const rolesReady = useMemo(() => (game?.round ?? 0) > 0, [game])
  const canAddPlayers = useMemo(() => {
    if (!game) {
      return false
    }
    return game.state === 'add_players' || game.state === 'inactive'
  }, [game])

  const canStart = useMemo(() => {
    if (!game) {
      return false
    }
    return (
      canAddPlayers &&
      game.playerCount >= MIN_PLAYERS &&
      game.playerCount <= MAX_PLAYERS
    )
  }, [game, canAddPlayers])

  const playersNeeded = useMemo(() => {
    if (!game) return MIN_PLAYERS
    return Math.max(MIN_PLAYERS - game.playerCount, 0)
  }, [game])

  useEffect(() => {
    if (!player?.token) {
      return
    }

    const round = game?.round ?? 0

    if (round === 0) {
      setRevealMessage('')
      setViewResult(null)
      setLastRevealRound(0)
      return
    }

    if (round === lastRevealRound) {
      return
    }

    let active = true
    setRevealMessage('')
    setViewResult(null)

    const reveal = async () => {
      try {
        const data = await request(`/api/games/${gameId}/reveal`, {
          method: 'POST',
          body: JSON.stringify({ token: player.token }),
        })
        if (active) {
          setRevealMessage(data.message)
          setLastRevealRound(round)
        }
      } catch (err) {
        if (active) {
          setNotice(err.message)
        }
      }
    }

    reveal()
    return () => {
      active = false
    }
  }, [gameId, game?.round, lastRevealRound, player?.token])

  const handleJoin = async (event) => {
    event.preventDefault()
    if (!game) {
      return
    }

    if (!canAddPlayers) {
      setNotice('Game already started. Ask to restart to join.')
      return
    }

    const name = nameInput.trim()
    if (!name) {
      setNotice('Enter your name to join.')
      return
    }

    setBusyAction('join')
    setNotice('')
    try {
      const data = await request(`/api/games/${gameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      const nextPlayer = { name: data.name, token: data.token }
      setPlayer(nextPlayer)
      setStoredPlayer(gameId, nextPlayer)
      setNameInput('')
      await refreshGame()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusyAction('')
    }
  }

  const runAction = async (action, fn) => {
    setBusyAction(action)
    setNotice('')
    setError('')
    try {
      await fn()
      await refreshGame()
    } catch (err) {
      setNotice(err.message)
    } finally {
      setBusyAction('')
    }
  }

  const startGame = () =>
    runAction('start', async () => {
      if (!player?.token) {
        throw new Error('Join the game to start it.')
      }
      await request(`/api/games/${gameId}/start`, { method: 'POST' })
    })

  const assignRoles = () =>
    runAction('assign', async () => {
      if (!player?.token) {
        throw new Error('Join the game to assign roles.')
      }
      await request(`/api/games/${gameId}/assign`, { method: 'POST' })
    })

  const viewParty = () =>
    runAction('view', async () => {
      if (!player?.token) {
        throw new Error('Join the game to view party membership.')
      }
      const data = await request(`/api/games/${gameId}/view-party`, {
        method: 'POST',
        body: JSON.stringify({ token: player.token, targetName: viewTarget }),
      })
      setViewResult(data)
    })

  const endGame = () =>
    runAction('end', async () => {
      if (!player?.token) {
        throw new Error('Join the game to end it.')
      }
      await request(`/api/games/${gameId}/end`, { method: 'POST' })
      clearStoredPlayer(gameId)
      setPlayer(null)
      setRevealMessage('')
      setViewResult(null)
      setLastRevealRound(0)
    })

  if (loading) {
    return (
      <div className="app">
        <p className="muted">Loading game…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <p className="notice">{error}</p>
        <button className="btn" type="button" onClick={() => navigate('/')}>
          Back home
        </button>
      </div>
    )
  }

  if (!game) {
    return null
  }

  // Not joined yet - show join screen
  if (!player) {
    return (
      <div className="app">
        <header className="hero centered">
          <p className="eyebrow">Game id</p>
          <h1 className="game-code">{gameId}</h1>
          <p className="lead">Enter your name to join this game.</p>
        </header>

        <section className="card join-card">
          <h2>Join game</h2>
          <form className="join-form" onSubmit={handleJoin}>
            <input
              type="text"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              disabled={!canAddPlayers || game.playerCount >= MAX_PLAYERS}
              autoFocus
            />
            <button
              className="btn large"
              type="submit"
              disabled={
                busyAction === 'join' ||
                !canAddPlayers ||
                game.playerCount >= MAX_PLAYERS
              }
            >
              {busyAction === 'join' ? 'Joining…' : 'Join'}
            </button>
          </form>
          {notice ? <p className="notice">{notice}</p> : null}
          {!canAddPlayers ? (
            <p className="notice">Game already started. Ask to restart to join.</p>
          ) : game.playerCount >= MAX_PLAYERS ? (
            <p className="notice">Game is full (10 players).</p>
          ) : null}
        </section>

        <section className="card">
          <h2>Players ({game.playerCount})</h2>
          {game.players.length ? (
            <ul className="player-list">
              {game.players.map((playerName) => (
                <li key={playerName}>{playerName}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No players have joined yet.</p>
          )}
        </section>

        <footer className="footer-nav">
          <button className="btn ghost" type="button" onClick={() => navigate('/')}>
            ← Back
          </button>
        </footer>
      </div>
    )
  }

  // Joined - Waiting for players
  if (canAddPlayers && !canStart) {
    return (
      <div className="app">
        <header className="hero centered">
          <p className="eyebrow">Game id</p>
          <h1 className="game-code">{gameId}</h1>
        </header>

        <section className="card waiting-card">
          <div className="waiting-indicator">
            <div className="spinner" />
          </div>
          <h2>Waiting for players</h2>
          <p className="player-name-display">{player.name}</p>
          <p className="muted">
            {playersNeeded > 0
              ? `Need ${playersNeeded} more player${playersNeeded > 1 ? 's' : ''} to start`
              : 'Waiting for others to join…'}
          </p>
          <div className="player-count-display">
            <span className="count">{game.playerCount}</span>
            <span className="label">/ {MIN_PLAYERS}-{MAX_PLAYERS} players</span>
          </div>
        </section>

        <section className="card">
          <h2>Players</h2>
          <ul className="player-list">
            {game.players.map((playerName) => (
              <li key={playerName} className={playerName === player.name ? 'you' : ''}>
                {playerName}
                {playerName === player.name ? <span className="you-badge">you</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {notice ? <p className="notice">{notice}</p> : null}

        <footer className="footer-nav">
          <button className="btn ghost" type="button" onClick={() => navigate('/')}>
            ← Back
          </button>
        </footer>
      </div>
    )
  }

  // Joined - Ready to start
  if (canAddPlayers && canStart) {
    return (
      <div className="app">
        <header className="hero centered">
          <p className="eyebrow">Game id</p>
          <h1 className="game-code">{gameId}</h1>
        </header>

        <section className="card ready-card">
          <div className="ready-indicator">✓</div>
          <h2>Ready to start!</h2>
          <p className="player-name-display">{player.name}</p>
          <p className="muted">All players are in. Anyone can start the game.</p>
          <div className="player-count-display">
            <span className="count">{game.playerCount}</span>
            <span className="label">players</span>
          </div>
          <button
            className="btn large start-btn"
            type="button"
            onClick={startGame}
            disabled={busyAction === 'start'}
          >
            {busyAction === 'start' ? 'Starting…' : 'Start Game'}
          </button>
        </section>

        <section className="card">
          <h2>Players</h2>
          <ul className="player-list">
            {game.players.map((playerName) => (
              <li key={playerName} className={playerName === player.name ? 'you' : ''}>
                {playerName}
                {playerName === player.name ? <span className="you-badge">you</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {notice ? <p className="notice">{notice}</p> : null}

        <footer className="footer-nav">
          <button className="btn ghost" type="button" onClick={() => navigate('/')}>
            ← Back
          </button>
        </footer>
      </div>
    )
  }

  // Game active - waiting for role assignment
  if (game.state === 'active' && !rolesReady) {
    return (
      <div className="app">
        <header className="hero centered">
          <p className="eyebrow">Game id</p>
          <h1 className="game-code">{gameId}</h1>
        </header>

        <section className="card assign-card">
          <h2>Game Started</h2>
          <p className="player-name-display">{player.name}</p>
          <p className="muted">Assign roles to begin playing.</p>
          <button
            className="btn large assign-btn"
            type="button"
            onClick={assignRoles}
            disabled={busyAction === 'assign'}
          >
            {busyAction === 'assign' ? 'Assigning…' : 'Assign Roles'}
          </button>
        </section>

        <section className="card">
          <h2>Players ({game.playerCount})</h2>
          <ul className="player-list">
            {game.players.map((playerName) => (
              <li key={playerName} className={playerName === player.name ? 'you' : ''}>
                {playerName}
                {playerName === player.name ? <span className="you-badge">you</span> : null}
              </li>
            ))}
          </ul>
        </section>

        {notice ? <p className="notice">{notice}</p> : null}

        <section className="card danger-zone">
          <button
            className="btn danger"
            type="button"
            onClick={endGame}
            disabled={busyAction === 'end'}
          >
            {busyAction === 'end' ? 'Ending…' : 'End Game'}
          </button>
        </section>

        <footer className="footer-nav">
          <button className="btn ghost" type="button" onClick={() => navigate('/')}>
            ← Back
          </button>
        </footer>
      </div>
    )
  }

  // Game active - roles assigned, show your role
  return (
    <div className="app">
      <header className="hero centered">
        <p className="eyebrow">Round {game.round}</p>
        <h1 className="game-code">{gameId}</h1>
      </header>

      <section className="card role-card">
        <h2>Your Role</h2>
        <p className="player-name-display">{player.name}</p>
        <div className={`role-reveal ${getRoleClass(revealMessage)}`}>
          {revealMessage || 'Fetching your role...'}
        </div>
      </section>

      <section className="card actions-card">
        <h2>Actions</h2>
        <div className="action-buttons">
          <button
            className="btn large"
            type="button"
            onClick={assignRoles}
            disabled={busyAction === 'assign'}
          >
            {busyAction === 'assign' ? 'Assigning…' : 'New Round'}
          </button>
        </div>

        <div className="view-party-section">
          <h3>Investigate Party Membership</h3>
          <p className="muted">Presidential power: view a player's party card.</p>
          <div className="view-party-row">
            <select
              value={viewTarget}
              onChange={(event) => setViewTarget(event.target.value)}
              disabled={!game.players.length}
              aria-label="Select player to view"
            >
              {game.players.length ? (
                game.players.map((playerName) => (
                  <option key={playerName} value={playerName}>
                    {playerName}
                  </option>
                ))
              ) : (
                <option value="">No players</option>
              )}
            </select>
            <button
              className="btn secondary"
              type="button"
              onClick={viewParty}
              disabled={!player?.token || busyAction === 'view'}
            >
              {busyAction === 'view' ? 'Viewing…' : 'View Party'}
            </button>
          </div>
          {viewResult ? (
            <div className="view-result">
              <strong>{viewResult.name}'s</strong> party is <strong>{viewResult.party}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card">
        <h2>Players ({game.playerCount})</h2>
        <ul className="player-list">
          {game.players.map((playerName) => (
            <li key={playerName} className={playerName === player.name ? 'you' : ''}>
              {playerName}
              {playerName === player.name ? <span className="you-badge">you</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Activity</h2>
        {game.events?.length ? (
          <ul className="activity-list">
            {game.events.map((event) => (
              <li key={event.id}>{event.message}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No activity yet.</p>
        )}
      </section>

      {notice ? <p className="notice">{notice}</p> : null}

      <section className="card danger-zone">
        <button
          className="btn danger"
          type="button"
          onClick={endGame}
          disabled={busyAction === 'end'}
        >
          {busyAction === 'end' ? 'Ending…' : 'End Game'}
        </button>
      </section>

      <footer className="footer-nav">
        <button className="btn ghost" type="button" onClick={() => navigate('/')}>
          ← Back
        </button>
      </footer>
    </div>
  )
}

const getRoleClass = (message) => {
  if (!message) return ''
  const lower = message.toLowerCase()
  if (lower.includes('liberal')) return 'liberal'
  if (lower.includes('hitler')) return 'hitler'
  if (lower.includes('fascist')) return 'fascist'
  return ''
}

export default function App() {
  const { path, navigate } = useRoute()

  const match = path.match(/^\/g\/([a-z]{5})$/)
  if (match) {
    return <Game gameId={match[1]} navigate={navigate} />
  }

  return <Home navigate={navigate} />
}
