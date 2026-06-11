// backend/src/lib/sentry.js
// Sentry error tracking with PII scrubbing
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,             // 10% of transactions
    beforeSend: (event) => {
      // Strip PII from error reports
      if (event.user) {
        delete event.user.email
        delete event.user.username
      }
      return event
    }
  })
  console.log('   Sentry: configured ✓')
} else {
  console.log('   Sentry: not configured (set SENTRY_DSN)')
}

export { Sentry }
