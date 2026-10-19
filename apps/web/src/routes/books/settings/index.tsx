import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { useTheme, type Theme } from "#/hooks/use-theme.ts"
import { useSetBreadcrumbs } from "#/routes/books/-lib/breadcrumbs.ts"
import { createFileRoute } from "@tanstack/react-router"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

export const Route = createFileRoute("/books/settings/")({
  component: RouteComponent,
})

const THEME_CHOICES: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
]

function RouteComponent() {
  useSetBreadcrumbs([{ title: "Dashboard", url: "/books" }, { title: "Settings" }])
  const [theme, setTheme] = useTheme()

  return (
    <>
      <h2 className="pb-2">Settings</h2>
      <div className="mt-4 grid max-w-2xl gap-6">
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
