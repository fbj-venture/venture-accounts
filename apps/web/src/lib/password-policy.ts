// The password rules: shared by the set-password form and the server (see the
// hooks in lib/auth.ts). No server-only imports here, so the browser can use it.

export const MIN_PASSWORD_LENGTH = 14

// Symbols that are safe in URLs, forms and email links (no quotes, brackets,
// slashes, backslash, &, < or >).
export const PASSWORD_SYMBOLS = "!@#$%^*()_+-=.,?~"

const ALLOWED = new RegExp(`^[A-Za-z0-9${PASSWORD_SYMBOLS.replace(/[\]\\^-]/g, "\\$&")}]*$`)
const SYMBOL = new RegExp(`[${PASSWORD_SYMBOLS.replace(/[\]\\^-]/g, "\\$&")}]`)

/** Why the password isn't acceptable, or null if it is. Shared by the form and the server. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (/\s/.test(password)) {
    return "The password can't contain spaces."
  }
  if (!/[A-Z]/.test(password)) {
    return "The password needs an upper-case letter."
  }
  if (!/[a-z]/.test(password)) {
    return "The password needs a lower-case letter."
  }
  if (!/[0-9]/.test(password)) {
    return "The password needs a number."
  }
  if (!SYMBOL.test(password)) {
    return `The password needs a symbol (${PASSWORD_SYMBOLS}).`
  }
  if (!ALLOWED.test(password)) {
    return `The password can only use letters, numbers and these symbols: ${PASSWORD_SYMBOLS}`
  }
  return null
}

export type PasswordCheck = { label: string; met: boolean }

/** Each rule on its own, for a live checklist beside the password field. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    {
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: "An upper-case letter (A-Z)", met: /[A-Z]/.test(password) },
    { label: "A lower-case letter (a-z)", met: /[a-z]/.test(password) },
    { label: "A number (0-9)", met: /[0-9]/.test(password) },
    { label: `A symbol (${PASSWORD_SYMBOLS})`, met: SYMBOL.test(password) },
    {
      label: "No spaces or other characters",
      met: password !== "" && !/\s/.test(password) && ALLOWED.test(password),
    },
  ]
}
