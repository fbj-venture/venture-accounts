import { Button } from "#/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import { IMPORTERS } from "#/lib/importers.ts"
import { useQueryClient } from "@tanstack/react-query"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { saveHiddenImporters } from "../-server/company.server.ts"
import { companyKeys } from "./company-queries.ts"

// Which of the importer cards on the Kind of Import page are shown. Hiding one
// only removes its card; the import page itself is still reachable by its URL.
export function ImportVisibilityCard({ hiddenImporters }: { hiddenImporters: string[] }) {
  const queryClient = useQueryClient()
  // The keys of the cards left showing, so ticking means "show".
  const [shown, setShown] = useState<Set<string>>(
    () => new Set(IMPORTERS.map((i) => i.key).filter((key) => !hiddenImporters.includes(key))),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const isChanged = IMPORTERS.some(
    (importer) => shown.has(importer.key) === hiddenImporters.includes(importer.key),
  )

  function toggle(key: string, show: boolean) {
    setShown((previous) => {
      const next = new Set(previous)
      if (show) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
    setJustSaved(false)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!isChanged || saving) {
      return
    }
    setSaving(true)
    setSaveError(null)
    setJustSaved(false)
    try {
      await saveHiddenImporters({
        data: {
          hiddenImporters: IMPORTERS.map((i) => i.key).filter((key) => !shown.has(key)),
        },
      })
      // Re-reads the settings, which the import page gets from the /books
      // layout's provider.
      await queryClient.invalidateQueries({ queryKey: companyKeys.all })
      setJustSaved(true)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Couldn't save the settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="contents">
        <CardHeader>
          <CardTitle>Import</CardTitle>
          <CardDescription>
            Choose which kinds of import are offered on the Kind of Import page.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {IMPORTERS.map((importer) => (
            <label key={importer.key} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={shown.has(importer.key)}
                onCheckedChange={(checked) => toggle(importer.key, checked === true)}
              />
              {importer.title}
            </label>
          ))}
          {saveError ? (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          {justSaved ? (
            <span className="text-sm text-muted-foreground" role="status">
              Saved.
            </span>
          ) : null}
          <Button type="submit" disabled={!isChanged || saving}>
            {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
