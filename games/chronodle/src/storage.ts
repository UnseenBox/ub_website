// localStorage can be missing or throw (private mode, blocked storage, portal
// iframes), so every access is guarded and the game still runs without it.
const PREFIX = 'chronodle:v1:'

export function load<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage full or blocked: progress just won't survive a reload.
  }
}
