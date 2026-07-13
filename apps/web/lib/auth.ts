import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  // nextCookies() must be the last plugin: it forwards Set-Cookie from
  // server actions to the browser.
  plugins: [nextCookies()],
})
