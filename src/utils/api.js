const shouldLog = () => {
  if (typeof window === 'undefined') {
    return false
  }
  if (import.meta?.env?.DEV) {
    return true
  }
  try {
    if (window.localStorage.getItem('shra:debug') === 'true') {
      return true
    }
  } catch {
    // localStorage not available
  }
  return new URLSearchParams(window.location.search).has('debug')
}

export const request = async (path, options = {}) => {
  const logging = shouldLog()

  if (logging) {
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
  } catch {
    payload = {}
  }

  if (logging) {
    console.info('[api] response', {
      path,
      status: response.status,
      ok: response.ok,
      payload,
    })
  }

  if (!response.ok) {
    if (logging) {
      console.error('[api] error', { path, status: response.status, payload })
    }
    throw new Error(payload.error || 'Request failed.')
  }

  return payload
}

