import { Button } from "#/components/ui/button.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { LoaderCircleIcon, UploadIcon } from "lucide-react"
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  parseAccountsJson,
  validateImport,
  type ExistingAccount,
  type ImportAccount,
} from "./-lib/accounts-import.ts"
import { accountKeys, accountsQuery, accountTypesQuery } from "./-lib/accounts-queries.ts"
import { EditImportAccountDialog } from "./-lib/edit-import-account-dialog.tsx"
import { ImportPreviewTable, type PreviewRow } from "./-lib/import-preview-table.tsx"
import { importAccounts } from "./-server/accounts-import.server.ts"

export const Route = createFileRoute("/books/accounts/import")({
  // Rendered in the browser only, like the Accounts page.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(accountsQuery),
      queryClient.ensureQueryData(accountTypesQuery),
    ])
  },
  pendingComponent: () => <p className="py-2 text-sm text-muted-foreground">Loading accounts...</p>,
  component: RouteComponent,
})

// An item of the list being previewed. The id is for finding the item to edit
// or tick: items are edited and removed, so the position isn't stable. Only
// the ticked items are imported.
type ListItem = ImportAccount & { id: number; checked: boolean }

const plural = (count: number, what: string) => `${count} ${what}${count === 1 ? "" : "s"}`

function RouteComponent() {
  useSetBreadcrumbs([
    { title: "Dashboard", url: "/books" },
    { title: "Accounts", url: "/books/accounts" },
    { title: "Import" },
  ])
  const { data: accounts } = useSuspenseQuery(accountsQuery)
  const { data: accountTypes } = useSuspenseQuery(accountTypesQuery)
  const router = useRouter()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [fileName, setFileName] = useState<string | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const nextId = useRef(0)

  const typeNames = useMemo(() => accountTypes.map((type) => type.name), [accountTypes])
  const existing = useMemo<ExistingAccount[]>(
    () =>
      accounts.map((row) => ({
        name: row.name,
        isSubAccount: row.parentId !== null,
        accountType: row.accountType,
      })),
    [accounts],
  )
  // Only the ticked items are imported, so only they are checked (and a ticked
  // sub-account needs its parent ticked too, unless it is in the books already).
  // Re-checked after every edit or tick, so fixing one item can clear the
  // problems of another (a duplicate name, a parent that was missing).
  const ticked = useMemo(() => items.filter((item) => item.checked), [items])
  const checks = useMemo(
    () => validateImport(ticked, existing, typeNames),
    [ticked, existing, typeNames],
  )
  const rows = useMemo<PreviewRow[]>(() => {
    let tickedIndex = 0
    return items.map((item) => {
      if (!item.checked) {
        return { ...item, status: { kind: "unchecked" } }
      }
      const check = checks[tickedIndex++]!
      return {
        ...item,
        status: check.exists
          ? { kind: "exists" }
          : check.errors.length > 0
            ? { kind: "error", text: check.errors.join(" ") }
            : { kind: "new" },
      }
    })
  }, [items, checks])
  const problemCount = rows.filter((row) => row.status.kind === "error").length
  const newCount = rows.filter((row) => row.status.kind === "new").length
  const existsCount = rows.filter((row) => row.status.kind === "exists").length

  // State setters only, so they never change (the table's columns depend on them).
  const toggle = useCallback((id: number, checked: boolean) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, checked } : item)))
  }, [])
  const toggleAll = useCallback((checked: boolean) => {
    setItems((current) => current.map((item) => ({ ...item, checked })))
  }, [])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setFileError(null)
    setImportError(null)
    try {
      const parsed = parseAccountsJson(await file.text())
      setItems(parsed.map((item) => ({ ...item, id: nextId.current++, checked: true })))
      setFileName(file.name)
    } catch (caught) {
      setItems([])
      setFileName(null)
      setFileError(caught instanceof Error ? caught.message : "Couldn't read the file.")
    }
  }

  const edit = useCallback((id: number) => setEditingId(id), [])
  const editing = items.find((item) => item.id === editingId)
  // The accounts the one being edited could go under: any that isn't a
  // sub-account itself, from the books or from the list.
  const parentChoices = useMemo(() => {
    const fromBooks = accounts
      .filter((row) => row.parentId === null)
      .map((row) => ({ name: row.name, accountType: row.accountType }))
    const fromList = items
      .filter(
        (item) => item.id !== editingId && item.parent.trim() === "" && item.name.trim() !== "",
      )
      .map((item) => ({ name: item.name.trim(), accountType: item.accountType }))
    // An item already in the books is in both lists; offer it once.
    const seen = new Set(fromBooks.map((choice) => choice.name.toLowerCase()))
    return [
      ...fromBooks,
      ...fromList.filter((choice) => !seen.has(choice.name.toLowerCase())),
    ].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }, [accounts, items, editingId])

  async function runImport() {
    setImporting(true)
    setImportError(null)
    try {
      await importAccounts({
        data: {
          items: ticked.map(({ id: _id, checked: _checked, ...item }) => item),
        },
      })
      await queryClient.invalidateQueries({ queryKey: accountKeys.all })
      await router.invalidate({ sync: true })
      await navigate({ to: "/books/accounts" })
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : "Couldn't import the accounts.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <h2 className="pb-2">Import accounts</h2>
      <p className="py-2">
        Upload a JSON file with a list of accounts. Each has a <code>name</code> and an{" "}
        <code>accountType</code>, and optionally a <code>description</code> and a list of{" "}
        <code>children</code> (its sub-accounts, with the same fields and the parent's type).
        Nothing is added until you import.
      </p>
      <Field className="mt-2 max-w-md">
        <FieldLabel htmlFor="import-accounts-file">Accounts file</FieldLabel>
        <Input
          id="import-accounts-file"
          type="file"
          accept=".json,application/json"
          onChange={chooseFile}
          disabled={importing}
        />
      </Field>
      {fileError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {fileError}
        </p>
      ) : null}

      {fileName ? (
        <>
          <p className="py-2 text-sm text-muted-foreground">
            {fileName}: {plural(items.length, "account")}, {ticked.length} ticked: {newCount} new
            {existsCount > 0 ? `, ${existsCount} already in the books (skipped)` : ""}
            {problemCount > 0
              ? `, ${problemCount === 1 ? "1 has a problem" : `${problemCount} have problems`} to fix before importing.`
              : newCount === 0
                ? ". Nothing new to import."
                : ", ready to import."}{" "}
            Only ticked accounts are imported. Select a name to edit it.
          </p>
          <ImportPreviewTable data={rows} onToggle={toggle} onToggleAll={toggleAll} onEdit={edit} />
          {importError ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {importError}
            </p>
          ) : null}
          <div className="mt-4">
            <Button
              type="button"
              disabled={importing || newCount === 0 || problemCount > 0}
              onClick={runImport}
            >
              {importing ? <LoaderCircleIcon className="animate-spin" /> : <UploadIcon />}
              Import {plural(newCount, "new account")}
            </Button>
          </div>
        </>
      ) : null}

      {editing ? (
        <EditImportAccountDialog
          key={editing.id}
          item={editing}
          accountTypes={typeNames}
          parents={parentChoices}
          onSave={(changed) => {
            setItems((current) =>
              current.map((item) =>
                item.id === editing.id ? { ...changed, id: item.id, checked: item.checked } : item,
              ),
            )
            setEditingId(null)
          }}
          onRemove={() => {
            setItems((current) => current.filter((item) => item.id !== editing.id))
            setEditingId(null)
          }}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </>
  )
}
