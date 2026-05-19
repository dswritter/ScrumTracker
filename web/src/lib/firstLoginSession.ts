/** After a correct temp-password login, skip re-entering it on /change-password. */
const KEY = 'scrum-tracker-first-login-verified'

export function markFirstLoginPasswordVerified(userId: string): void {
  try {
    sessionStorage.setItem(KEY, userId)
  } catch {
    /* private mode / quota */
  }
}

export function clearFirstLoginPasswordVerified(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function isFirstLoginPasswordVerified(userId: string): boolean {
  try {
    return sessionStorage.getItem(KEY) === userId
  } catch {
    return false
  }
}
