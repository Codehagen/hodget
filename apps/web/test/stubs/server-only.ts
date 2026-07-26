// Test stub for the `server-only` guard package. In production `server-only`
// throws if imported into a client bundle; under vitest (plain Node) there is no
// React Server condition, so we alias it to this no-op to import server modules.
export {}
