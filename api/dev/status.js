import { json } from '../_http.js'

export default async function handler(req, res) {
  // Returns whether dev mode is enabled
  return json(res, 200, {
    devMode: process.env.DEV_MODE === 'true',
  })
}

