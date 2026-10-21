import {
  MAX_ACCOUNT_DESCRIPTION_LENGTH,
  MAX_ACCOUNT_NAME_LENGTH,
} from "../-server/accounts.server.ts"

// What the import page works with: the file's tree flattened, each
// sub-account naming its parent. isArchived isn't in the file (imported
// accounts start out active) but can be ticked while previewing.
export type ImportAccount = {
  name: string
  description: string
  /** An Account Type's name, e.g. "Expense". */
  accountType: string
  /** The name of the parent Account (in the file or already in the books); "" for none. */
  parent: string
  isArchived: boolean
}

// What validateImport needs to know about the Accounts already in the books.
export type ExistingAccount = {
  name: string
  isSubAccount: boolean
  accountType: string
}

// The import file is a JSON list of accounts (see data/temp/accounts.json):
//   [{ "name", "description", "accountType", "children": [{ same }] }]
// Only the top-level accounts have children; description and children may be
// left out.
function parseAccount(
  entry: unknown,
  label: string,
  parent: string,
  into: ImportAccount[],
  allowChildren: boolean,
) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`${label} isn't an account.`)
  }
  const record = entry as Record<string, unknown>
  if (typeof record.name !== "string") {
    throw new Error(`${label}: "name" must be text.`)
  }
  if (typeof record.accountType !== "string") {
    throw new Error(`${label}: "accountType" must be text.`)
  }
  if (
    record.description !== undefined &&
    record.description !== null &&
    typeof record.description !== "string"
  ) {
    throw new Error(`${label}: "description" must be text.`)
  }
  into.push({
    name: record.name,
    description: record.description ?? "",
    accountType: record.accountType,
    parent,
    isArchived: false,
  })

  if (record.children === undefined || record.children === null) {
    return
  }
  if (!allowChildren) {
    throw new Error(`${label}: a sub-account can't have sub-accounts.`)
  }
  if (!Array.isArray(record.children)) {
    throw new Error(`${label}: "children" must be a list of accounts.`)
  }
  record.children.forEach((child: unknown, index) => {
    parseAccount(child, `${label}, sub-account ${index + 1}`, record.name as string, into, false)
  })
}

// Reads the contents of an import file into a flat list, each parent followed
// by its sub-accounts. Only the shape is checked here (so every item can be
// shown); the rules about the accounts themselves are validateImport's.
export function parseAccountsJson(text: string): ImportAccount[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("The file isn't valid JSON.")
  }
  if (!Array.isArray(data)) {
    throw new Error("The file must contain a list of accounts.")
  }
  const items: ImportAccount[] = []
  data.forEach((entry: unknown, index) => {
    parseAccount(entry, `Item ${index + 1}`, "", items, true)
  })
  return items
}

const key = (text: string) => text.trim().toLowerCase()

// What validateImport found about one item: its problems (none means it is
// fine), and whether an account with its name is already in the books. Such an
// item is skipped, not an error, so importing the same file twice is harmless.
export type ItemCheck = { errors: string[]; exists: boolean }

// The check of each item, in the same order as the items. These are the rules
// of createAccount, applied to the whole list at once: names are unique
// (ignoring case) within the list, and a sub-account has a parent that isn't a
// sub-account itself and shares its type. Pass only the items to be imported:
// a parent left out of the list must already be in the books. Also run on the
// server before anything is written.
export function validateImport(
  items: ImportAccount[],
  existing: ExistingAccount[],
  typeNames: string[],
): ItemCheck[] {
  const existingByName = new Map(existing.map((account) => [key(account.name), account]))
  const knownTypes = new Set(typeNames.map(key))
  const firstByName = new Map<string, number>()
  items.forEach((item, index) => {
    if (!firstByName.has(key(item.name))) {
      firstByName.set(key(item.name), index)
    }
  })

  return items.map((item, index) => {
    const errors: string[] = []
    const name = item.name.trim()

    if (name !== "" && existingByName.has(key(name))) {
      return { errors, exists: true }
    }
    if (name === "") {
      errors.push("The name can't be empty.")
    } else {
      if (name.length > MAX_ACCOUNT_NAME_LENGTH) {
        errors.push(`The name can be at most ${MAX_ACCOUNT_NAME_LENGTH} characters.`)
      }
      if (firstByName.get(key(name)) !== index) {
        errors.push("Another account in the list has this name.")
      }
    }
    if (item.description.trim().length > MAX_ACCOUNT_DESCRIPTION_LENGTH) {
      errors.push(`The description can be at most ${MAX_ACCOUNT_DESCRIPTION_LENGTH} characters.`)
    }
    if (!knownTypes.has(key(item.accountType))) {
      errors.push(`"${item.accountType}" isn't an account type.`)
    }

    const parentName = item.parent.trim()
    if (parentName !== "") {
      const parentIndex = firstByName.get(key(parentName))
      const parentInFile = parentIndex === undefined ? undefined : items[parentIndex]
      const parentInBooks = existingByName.get(key(parentName))
      if (key(parentName) === key(name)) {
        errors.push("An account can't be its own parent.")
      } else if (parentInBooks) {
        if (parentInBooks.isSubAccount) {
          errors.push(`"${parentInBooks.name}" is a sub-account, which can't have sub-accounts.`)
        } else if (key(parentInBooks.accountType) !== key(item.accountType)) {
          errors.push(`A sub-account must have its parent's type (${parentInBooks.accountType}).`)
        }
      } else if (parentInFile) {
        if (parentInFile.parent.trim() !== "") {
          errors.push(`"${parentInFile.name}" is a sub-account, which can't have sub-accounts.`)
        } else if (key(parentInFile.accountType) !== key(item.accountType)) {
          errors.push(`A sub-account must have its parent's type (${parentInFile.accountType}).`)
        }
      } else {
        errors.push(`The parent "${parentName}" isn't being imported or in the books.`)
      }
    }
    return { errors, exists: false }
  })
}

// The app creates this one itself (see opening-balance.server.ts), so a file
// that contained it would fail to import into a fresh database.
const SEEDED_ACCOUNT_NAME = "Opening Balance Equity"

// The Accounts as the text of an import file: top-level accounts, each with
// its sub-accounts as "children". Bank accounts are left out: the file can't
// carry their bank details, so they are added on the Bank Accounts page
// instead. Whether an account is archived isn't in the file.
export function exportAccountsJson(
  accounts: {
    name: string
    description: string | null
    accountType: string
    parentName: string | null
    bankName: string | null
  }[],
) {
  const exported = accounts.filter(
    (row) => row.bankName === null && row.name !== SEEDED_ACCOUNT_NAME,
  )
  const toItem = (row: (typeof exported)[number]) => ({
    name: row.name,
    description: row.description ?? "",
    accountType: row.accountType,
  })
  const tree = exported
    .filter((row) => row.parentName === null)
    .map((row) => {
      const children = exported.filter((child) => child.parentName === row.name).map(toItem)
      return children.length > 0 ? { ...toItem(row), children } : toItem(row)
    })
  return JSON.stringify(tree, null, 2)
}
