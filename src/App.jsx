import { useEffect, useMemo, useRef, useState } from 'react'
import DevPanel from './DevPanel'

const Dropdown = ({ value, onChange, options, disabled, placeholder = 'Select...' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder

  return (
    <div className={`dropdown ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="dropdown-value">{selectedLabel}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <ul className="dropdown-menu">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={`dropdown-option ${opt.value === value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const MIN_PLAYERS = 5
const MAX_PLAYERS = 10
const GAME_ID_RE = /^[a-z]{5}$/
const POLL_INTERVAL = 2500

// Web Audio API ding sound generator
const playDing = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1) // Higher pitch
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.5)

    // Clean up after sound finishes
    setTimeout(() => ctx.close(), 600)
  } catch (error) {
    // Audio not supported or blocked
    console.warn('Could not play notification sound', error)
  }
}

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
  const [mode, setMode] = useState('create')
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
      <header className="hero centered">
        <p className="eyebrow">Secret Hitler</p>
        <h1>Role Assigner</h1>
      </header>

      <div className="mode-toggle">
        <button
          className={`mode-btn ${mode === 'create' ? 'active' : ''}`}
          type="button"
          onClick={() => { setMode('create'); setError('') }}
        >
          Create
        </button>
        <button
          className={`mode-btn ${mode === 'join' ? 'active' : ''}`}
          type="button"
          onClick={() => { setMode('join'); setError('') }}
        >
          Join
        </button>
      </div>

      {mode === 'create' ? (
        <section className="card home-card">
          <h2>Create game</h2>
          <p className="muted">Start a new session and share the code with friends.</p>
          <button className="btn large" type="button" onClick={handleCreate} disabled={busy}>
            {busy ? 'Creating…' : 'Create game'}
          </button>
        </section>
      ) : (
        <section className="card home-card">
          <h2>Join game</h2>
          <p className="muted">Enter a 5-letter game code to jump in.</p>
          <form className="join-form" onSubmit={handleJoin}>
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
        </section>
      )}

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
  const [justJoined, setJustJoined] = useState(false)
  const [showAssignConfirm, setShowAssignConfirm] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const seenEventIds = useRef(new Set())
  const initialLoadDone = useRef(false)

  useEffect(() => {
    setPlayer(getStoredPlayer(gameId))
    setNameInput('')
    setRevealMessage('')
    setLastRevealRound(0)
    setViewResult(null)
    setNotice('')
    setError('')
    setLoading(true)
    setJustJoined(false)
    setShowAssignConfirm(false)
    setShowEndConfirm(false)
    seenEventIds.current = new Set()
    initialLoadDone.current = false
  }, [gameId])

  // Play ding sound when party membership is viewed
  useEffect(() => {
    if (!game?.events?.length) return

    // Don't play sounds on initial load
    if (!initialLoadDone.current) {
      game.events.forEach((event) => seenEventIds.current.add(event.id))
      initialLoadDone.current = true
      return
    }

    // Check for new "party membership was viewed" events
    for (const event of game.events) {
      if (seenEventIds.current.has(event.id)) continue
      seenEventIds.current.add(event.id)

      if (event.message?.includes('party membership was viewed')) {
        playDing()
        break // Only play once per update
      }
    }
  }, [game?.events])

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

  // Get other players (exclude self) for party investigation
  const otherPlayers = useMemo(() => {
    if (!game?.players?.length || !player?.name) return []
    return game.players.filter((p) => p.toLowerCase() !== player.name.toLowerCase())
  }, [game?.players, player?.name])

  useEffect(() => {
    if (!otherPlayers.length) {
      setViewTarget('')
      return
    }

    if (!otherPlayers.includes(viewTarget)) {
      setViewTarget(otherPlayers[0])
    }
  }, [otherPlayers, viewTarget])

  useEffect(() => {
    // Don't check immediately after joining (race condition with game refresh)
    if (justJoined) {
      return
    }

    // Don't check if we don't have valid data
    if (!player || !game?.players || loading) {
      return
    }

    // Don't clear player if game has no players yet (could be stale data)
    if (game.players.length === 0) {
      return
    }

    const stillInGame = game.players.some(
      (playerName) => playerName.toLowerCase() === player.name.toLowerCase()
    )
    if (!stillInGame) {
      clearStoredPlayer(gameId)
      setPlayer(null)
      setNotice('You were removed from the game. Join again to participate.')
      setRevealMessage('')
      setViewResult(null)
      setLastRevealRound(0)
    }
  }, [game, player, gameId, justJoined, loading])

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
      setJustJoined(true)
      setPlayer(nextPlayer)
      setStoredPlayer(gameId, nextPlayer)
      setNameInput('')
      await refreshGame()
      // Clear the justJoined flag after game data is refreshed
      setJustJoined(false)
    } catch (err) {
      setNotice(err.message)
      setJustJoined(false)
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
      setRevealMessage('')
      setViewResult(null)
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

  const endGame = async () => {
    setBusyAction('end')
    setNotice('')
    setError('')
    try {
      await request(`/api/games/${gameId}/end`, { method: 'POST' })
      clearStoredPlayer(gameId)
      navigate('/')
    } catch (err) {
      setNotice(err.message)
      setBusyAction('')
    }
  }

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

        <section className="card game-actions-card">
          {!showEndConfirm ? (
            <button
              className="btn large danger full-width"
              type="button"
              onClick={() => setShowEndConfirm(true)}
            >
              End Game
            </button>
          ) : (
            <div className="assign-confirm">
              <p className="confirm-text">Are you sure? This will delete the game.</p>
              <div className="confirm-buttons">
                <button
                  className="btn large danger full-width"
                  type="button"
                  onClick={() => {
                    endGame()
                    setShowEndConfirm(false)
                  }}
                  disabled={busyAction === 'end'}
                >
                  {busyAction === 'end' ? 'Ending…' : 'End'}
                </button>
                <button
                  className="btn ghost full-width"
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  disabled={busyAction === 'end'}
                >
                  Cancel
                </button>
              </div>
            </div>
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

  // Game active - roles assigned, show your role
  return (
    <div className="app">
      <header className="hero centered">
        <h1 className="game-code">{gameId}</h1>
        <p className="round-label">Round {game.round}</p>
      </header>

      <section className="card role-card">
        <p className="player-name-display">{player.name}</p>
        <div className={`role-reveal ${getRoleClass(revealMessage)}`}>
          {revealMessage || 'Fetching your role...'}
        </div>
      </section>

      <section className="card players-compact">
        <h2>Players ({game.playerCount})</h2>
        <p className="players-line">{game.players.join(', ')}</p>
        <p className="role-distribution">{getRoleDistribution(game.playerCount)}</p>
      </section>

      <section className="card view-party-card">
        <h2>Investigate Party Membership</h2>
        <div className="view-party-row">
          <Dropdown
            value={viewTarget}
            onChange={setViewTarget}
            options={otherPlayers.map((name) => ({ value: name, label: name }))}
            disabled={!otherPlayers.length}
            placeholder="Select player"
          />
          <button
            className="btn secondary"
            type="button"
            onClick={viewParty}
            disabled={!player?.token || !otherPlayers.length || busyAction === 'view'}
          >
            {busyAction === 'view' ? 'Viewing…' : 'View Party'}
          </button>
        </div>
        {viewResult ? (
          <div className="view-result">
            <strong>{viewResult.name}'s</strong> party is <strong>{viewResult.party}</strong>
          </div>
        ) : null}
      </section>

      <section className="card game-actions-card">
        {!showAssignConfirm ? (
          <button
            className="btn large full-width"
            type="button"
            onClick={() => setShowAssignConfirm(true)}
          >
            New Round
          </button>
        ) : (
          <div className="assign-confirm">
            <p className="confirm-text">Ready to assign new roles?</p>
            <div className="confirm-buttons">
              <button
                className="btn large full-width"
                type="button"
                onClick={() => {
                  assignRoles()
                  setShowAssignConfirm(false)
                }}
                disabled={busyAction === 'assign'}
              >
                {busyAction === 'assign' ? 'Assigning…' : 'Assign'}
              </button>
              <button
                className="btn ghost full-width"
                type="button"
                onClick={() => setShowAssignConfirm(false)}
                disabled={busyAction === 'assign'}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {!showEndConfirm ? (
          <button
            className="btn large danger full-width"
            type="button"
            onClick={() => setShowEndConfirm(true)}
          >
            End Game
          </button>
        ) : (
          <div className="assign-confirm">
            <p className="confirm-text">Are you sure? This will delete the game.</p>
            <div className="confirm-buttons">
              <button
                className="btn large danger full-width"
                type="button"
                onClick={() => {
                  endGame()
                  setShowEndConfirm(false)
                }}
                disabled={busyAction === 'end'}
              >
                {busyAction === 'end' ? 'Ending…' : 'End'}
              </button>
              <button
                className="btn ghost full-width"
                type="button"
                onClick={() => setShowEndConfirm(false)}
                disabled={busyAction === 'end'}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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

const getRoleDistribution = (count) => {
  const distributions = {
    5: '3 Liberal, 1 Fascist, 1 Hitler. Hitler knows.',
    6: '4 Liberal, 1 Fascist, 1 Hitler. Hitler knows.',
    7: '4 Liberal, 2 Fascist, 1 Hitler. Hitler doesn\'t know.',
    8: '5 Liberal, 2 Fascist, 1 Hitler. Hitler doesn\'t know.',
    9: '5 Liberal, 3 Fascist, 1 Hitler. Hitler doesn\'t know.',
    10: '6 Liberal, 3 Fascist, 1 Hitler. Hitler doesn\'t know.',
  }
  return distributions[count] || ''
}

export default function App() {
  const { path, navigate } = useRoute()

  const match = path.match(/^\/g\/([a-z]{5})$/)
  const gameId = match ? match[1] : null

  return (
    <>
      {match ? (
        <Game gameId={gameId} navigate={navigate} />
      ) : (
        <Home navigate={navigate} />
      )}
      <DevPanel gameId={gameId} />
    </>
  )
}
