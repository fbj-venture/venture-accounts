// Rules for adding an expense by hand (routes/books/expense/new). No
// server-only imports, so the form and the server check against the same values.
export const MAX_EXPENSE_DESCRIPTION_LENGTH = 200

export const MAX_EXPENSE_IMAGE_BYTES = 10 * 1024 * 1024

// What a phone camera or gallery hands over.
export const EXPENSE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]

export type ExpenseField =
  | "bankAccountId"
  | "expenseAccountId"
  | "date"
  | "description"
  | "amount"
  | "photo"

export type ExpenseValues = {
  /** 0 or NaN when none is chosen. */
  bankAccountId: number
  expenseAccountId: number
  /** The calendar day as "yyyy-MM-dd". */
  date: string
  description: string
  /** In rand. An expense is always money out, so it must be positive; NaN when blank. */
  amount: number
  /** Undefined when no photo is chosen. */
  photo: { type: string; size: number } | undefined
}

/**
 * What is wrong with each field, by field; a field that is fine is left out.
 * Every field is required.
 */
export function expenseProblems(values: ExpenseValues): Partial<Record<ExpenseField, string>> {
  const problems: Partial<Record<ExpenseField, string>> = {}

  if (!Number.isInteger(values.bankAccountId) || values.bankAccountId <= 0) {
    problems.bankAccountId = "Choose the bank account it was paid from."
  }
  if (!Number.isInteger(values.expenseAccountId) || values.expenseAccountId <= 0) {
    problems.expenseAccountId = "Choose an expense account."
  }

  const day = new Date(`${values.date}T00:00:00Z`)
  if (values.date === "") {
    problems.date = "Enter the date."
  } else if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.date) ||
    Number.isNaN(day.getTime()) ||
    day.toISOString().slice(0, 10) !== values.date
  ) {
    problems.date = "Enter a valid date."
  }

  const description = values.description.trim()
  if (description === "") {
    problems.description = "Enter a description."
  } else if (description.length > MAX_EXPENSE_DESCRIPTION_LENGTH) {
    problems.description = `The description can be at most ${MAX_EXPENSE_DESCRIPTION_LENGTH} characters.`
  }

  if (Number.isNaN(values.amount)) {
    problems.amount = "Enter the amount."
  } else if (!Number.isFinite(values.amount) || values.amount <= 0) {
    problems.amount = "The amount must be greater than zero."
  } else if (Math.round(values.amount * 100) / 100 !== values.amount) {
    problems.amount = "The amount can have at most two decimal places."
  }

  if (!values.photo) {
    problems.photo = "Add a photo of the receipt."
  } else if (!EXPENSE_IMAGE_TYPES.includes(values.photo.type)) {
    problems.photo = "The photo must be a JPEG, PNG, WebP or HEIC image."
  } else if (values.photo.size === 0) {
    problems.photo = "The photo is empty."
  } else if (values.photo.size > MAX_EXPENSE_IMAGE_BYTES) {
    problems.photo = `The photo can be at most ${MAX_EXPENSE_IMAGE_BYTES / 1024 / 1024} MB.`
  }

  return problems
}
