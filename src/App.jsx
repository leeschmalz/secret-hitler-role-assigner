import { useEffect, useMemo, useState } from 'react'

const MIN_PLAYERS = 5
const MAX_PLAYERS = 10
const GAME_ID_RE = /^[a-z]{5}$/
const POLL_INTERVAL = 4000

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

const stateLabels = {
  inactive: 'Inactive',
  add_players: 'Adding players',
  active: 'Active',
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

  const playerStatus = useMemo(() => {
    if (!game || !player) {
      return ''
    }
    if (canAddPlayers) {
      if (canStart) {
        return 'Everyone is in. Start the game when ready.'
      }
      const needed = Math.max(MIN_PLAYERS - game.playerCount, 0)
      return `Waiting for other players. Need ${needed} more to start.`
    }
    if (game.state === 'active') {
      if (rolesReady) {
        return `Roles assigned for round ${game.round}.`
      }
      return 'Game started. Waiting to assign roles.'
    }
    return ''
  }, [game, player, canAddPlayers, canStart, rolesReady])

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
      setNotice(`Joined as ${data.name}. Waiting for other players.`)
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

  return (
    <div className="app">
      <header className="game-header">
        <div>
          <p className="eyebrow">Game id</p>
          <h1>{gameId}</h1>
          <p className="lead">Share this id so everyone can join.</p>
        </div>
        <button className="btn ghost" type="button" onClick={() => navigate('/')}>
          Exit
        </button>
      </header>

      <section className="card status">
        <div className="meta-row">
          <span className={`pill ${game.state}`}>{stateLabels[game.state] || 'Unknown'}</span>
          <span className="meta">Players: {game.playerCount}</span>
          <span className="meta">Round: {game.round || '-'}</span>
        </div>
        <p className="muted">Need {MIN_PLAYERS}-{MAX_PLAYERS} players to start.</p>
        {notice ? <p className="notice">{notice}</p> : null}
      </section>

      {!player ? (
        <section className="card">
          <h2>Join this game</h2>
          <form className="row" onSubmit={handleJoin}>
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
          <p className="muted">You can only join before the game starts.</p>
        </section>
      ) : (
        <section className="card">
          <h2>You're in</h2>
          <p className="lead">{player.name}</p>
          {playerStatus ? <p className="muted">{playerStatus}</p> : null}
        </section>
      )}

      {player ? (
        <section className="card">
          <h2>Actions</h2>
          <div className="action-grid">
            <button
              className="btn large"
              type="button"
              onClick={startGame}
              disabled={!canStart || busyAction === 'start'}
            >
              {busyAction === 'start' ? 'Starting…' : 'Start game'}
            </button>
            <button
              className="btn large"
              type="button"
              onClick={assignRoles}
              disabled={game.state !== 'active' || busyAction === 'assign'}
            >
              {busyAction === 'assign' ? 'Assigning…' : 'Assign roles'}
            </button>
            <div className="action-stack">
              <button
                className="btn large secondary"
                type="button"
                onClick={viewParty}
                disabled={!rolesReady || !player?.token || busyAction === 'view'}
              >
                {busyAction === 'view' ? 'Viewing…' : 'View party'}
              </button>
              <select
                value={viewTarget}
                onChange={(event) => setViewTarget(event.target.value)}
                disabled={!rolesReady || !game.players.length}
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
            </div>
            <button
              className="btn large danger"
              type="button"
              onClick={endGame}
              disabled={busyAction === 'end'}
            >
              {busyAction === 'end' ? 'Ending…' : 'End game'}
            </button>
          </div>
        </section>
      ) : null}

      {player ? (
        <section className="grid">
          <div className="card">
            <h2>Your role</h2>
            <p className="muted">Shown only on your device after roles are assigned.</p>
            <div className="result">
              <p>
                {rolesReady
                  ? revealMessage || 'Fetching your role...'
                  : 'Waiting for roles to be assigned.'}
              </p>
            </div>
          </div>
          <div className="card">
            <h2>Party membership</h2>
            <p className="muted">Only the viewer sees the party card.</p>
            <div className="result">
              <p>
                {viewResult
                  ? `${viewResult.name}'s party is ${viewResult.party}.`
                  : 'No membership viewed yet.'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2>Players</h2>
        {game.players.length ? (
          <ul className="list">
            {game.players.map((playerName) => (
              <li key={playerName}>{playerName}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No players have joined yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Activity</h2>
        {game.events?.length ? (
          <ul className="list muted">
            {game.events.map((event) => (
              <li key={event.id}>{event.message}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No activity yet.</p>
        )}
      </section>
    </div>
  )
}

export default function App() {
  const { path, navigate } = useRoute()

  const match = path.match(/^\/g\/([a-z]{5})$/)
  if (match) {
    return <Game gameId={match[1]} navigate={navigate} />
  }

  return <Home navigate={navigate} />
}
