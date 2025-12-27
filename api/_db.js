import { neon, neonConfig } from '@neondatabase/serverless'

neonConfig.fetchConnectionCache = true

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

export const sql = neon(databaseUrl)
