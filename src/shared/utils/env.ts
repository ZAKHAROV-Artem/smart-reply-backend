export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Environment variable ${name} is required but was not provided`)
  }
  return value
}

/**
 * Retrieve an environment variable or return undefined (no defaulting!).
 */
export function getEnv(name: string): string | undefined {
  return process.env[name]
}
