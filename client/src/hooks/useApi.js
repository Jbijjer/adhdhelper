async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  }

  if (body instanceof FormData) {
    opts.body = body
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`/api${path}`, opts)

  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const data = await res.json()
      message = data.error || message
    } catch {}
    throw new Error(message)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
}
