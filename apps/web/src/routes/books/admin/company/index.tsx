import { Button } from "#/components/ui/button.tsx"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import { Input } from "#/components/ui/input.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { companyProblem } from "#/lib/company-settings.ts"
import { useSetBreadcrumbs } from "../../-lib/breadcrumbs"
import { companyKeys, companySettingsQuery } from "./-lib/company-queries.ts"
import { ImportVisibilityCard } from "./-lib/import-visibility-card.tsx"
import { saveCompanySettings } from "./-server/company.server.ts"

export const Route = createFileRoute("/books/admin/company/")({
  // Rendered in the browser only: the loader fills the query cache (instantly
  // when it is still fresh) and the page reads it with useSuspenseQuery.
  ssr: false,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(companySettingsQuery)
  },
  pendingComponent: () => (
    <p className="py-2 text-sm text-muted-foreground">Loading company settings...</p>
  ),
  component: RouteComponent,
})

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Company Settings" }])
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: settings } = useSuspenseQuery(companySettingsQuery)

  const [name, setName] = useState(settings.name)
  const [month, setMonth] = useState(String(settings.financialYearEndMonth))
  // What's typed, as text, so a half-typed year isn't forced into a number.
  const [startingYear, setStartingYear] = useState(String(settings.startingYear))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const isChanged =
    name.trim() !== settings.name ||
    Number(month) !== settings.financialYearEndMonth ||
    startingYear.trim() !== String(settings.startingYear)
  const problem =
    startingYear.trim() === ""
      ? "Enter a starting year."
      : companyProblem({
          name,
          financialYearEndMonth: Number(month),
          startingYear: Number(startingYear),
        })

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!isChanged || problem || saving) {
      return
    }
    setSaving(true)
    setSaveError(null)
    setJustSaved(false)
    try {
      await saveCompanySettings({
        data: {
          name: name.trim(),
          financialYearEndMonth: Number(month),
          startingYear: Number(startingYear),
        },
      })
      // Re-reads the settings everywhere they are shown: the sidebar title and
      // every year list and date picker (via the /books layout's provider).
      await queryClient.invalidateQueries({ queryKey: companyKeys.all })
      // Re-runs the root route's loader too, so the page title and login page
      // name pick up the new company name.
      await router.invalidate()
      setJustSaved(true)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Couldn't save the settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <h2 className="pb-2">Company Settings</h2>
      <div className="mt-4 grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={save} className="contents">
            <CardHeader>
              <CardTitle>Company</CardTitle>
              <CardDescription>
                The company's name and when its financial year ends.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <Field>
                <FieldLabel htmlFor="company-name">Name</FieldLabel>
                <p className="text-sm text-muted-foreground">
                  The company's name, displayed throughout the app.
                </p>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setJustSaved(false)
                  }}
                  aria-invalid={isChanged && !name.trim() ? true : undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="company-year-end-month">Financial year end month</FieldLabel>
                <p className="text-sm text-muted-foreground">
                  The month the company's financial year ends in, e.g. February for a year running
                  from March to February.
                </p>
                <Select
                  value={month}
                  onValueChange={(value) => {
                    setMonth(value)
                    setJustSaved(false)
                  }}
                >
                  <SelectTrigger id="company-year-end-month" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, index) => (
                      <SelectItem key={label} value={String(index + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="company-starting-year">Starting year</FieldLabel>
                <p className="text-sm text-muted-foreground">
                  The first year offered by every year list and date picker.
                </p>
                <Input
                  id="company-starting-year"
                  type="number"
                  inputMode="numeric"
                  value={startingYear}
                  onChange={(event) => {
                    setStartingYear(event.target.value)
                    setJustSaved(false)
                  }}
                  aria-invalid={isChanged && problem ? true : undefined}
                  className="w-32"
                />
              </Field>
              {isChanged && problem ? (
                <p className="text-sm text-destructive" role="alert">
                  {problem}
                </p>
              ) : null}
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
              <Button type="submit" disabled={!isChanged || problem !== null || saving}>
                {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
                Save
              </Button>
            </CardFooter>
          </form>
        </Card>
        <ImportVisibilityCard hiddenImporters={settings.hiddenImporters} />
      </div>
    </>
  )
}
