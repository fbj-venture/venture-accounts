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
import { useTheme, type Theme } from "#/hooks/use-theme.ts"
import { refreshSession } from "#/routes/books/-lib/session-query.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { LoaderCircleIcon, MonitorIcon, MoonIcon, SaveIcon, SunIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { getMySettings, saveMySettings, startingYearProblem } from "./-server/settings.server.ts"

export const Route = createFileRoute("/books/settings/")({
  loader: async () => ({ settings: await getMySettings() }),
  component: RouteComponent,
})

const THEME_CHOICES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
]

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Settings" }])
  const router = useRouter()
  const queryClient = useQueryClient()
  const { settings } = Route.useLoaderData()
  const [theme, setTheme] = useTheme()

  // What's typed, as text, so a half-typed year isn't forced into a number.
  const [startingYear, setStartingYear] = useState(String(settings.startingYear))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const isChanged = startingYear.trim() !== String(settings.startingYear)
  const problem =
    startingYear.trim() === "" ? "Enter a year." : startingYearProblem(Number(startingYear))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!isChanged || problem || saving) {
      return
    }
    setSaving(true)
    setSaveError(null)
    setJustSaved(false)
    try {
      await saveMySettings({ data: { startingYear: Number(startingYear) } })
      // Reloads the settings, and the signed-in layout that hands the starting
      // year to every year drop-down, so the new value applies straight away.
      await refreshSession(queryClient)
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
      <h2 className="pb-2">Settings</h2>
      <div className="mt-4 grid max-w-2xl gap-6">
        <Card>
          <form onSubmit={save} className="contents">
            <CardHeader>
              <CardTitle>App settings</CardTitle>
              <CardDescription>Your own settings for this app.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="settings-starting-year">Starting year</FieldLabel>
                <Input
                  id="settings-starting-year"
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
                <p className="text-sm text-muted-foreground">
                  The first year offered by every year list and date picker.
                </p>
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
              </Field>
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
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Colour theme. System follows your device. This is remembered in this browser only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
              <SelectTrigger aria-label="Theme" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEME_CHOICES.map(({ value, label, Icon }) => (
                  <SelectItem key={value} value={value}>
                    <Icon />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
