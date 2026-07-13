import onlyWarn from "eslint-plugin-only-warn"

/**
 * eslint-plugin-only-warn patches `Linter.prototype.verify` at import time to
 * downgrade every severity-2 error to a warning. Importing the shared base/next
 * config triggers that patch. Consumers for which an ESLint error must stay an
 * error (e.g. the web app's DAL import boundary, a security control) can call
 * this to undo the patch within their own ESLint process.
 */
export function disableOnlyWarn() {
  onlyWarn.disable()
}
