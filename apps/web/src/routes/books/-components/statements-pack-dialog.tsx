import { Button } from "#/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { useCompanySettings } from "#/lib/company-settings.ts"
import { financialYears } from "#/lib/financial-year.ts"
import { DownloadIcon, LoaderCircleIcon } from "lucide-react"
import { useMemo, useState } from "react"

type Missing = { problem: string; missing: string[] }

// The file name the server chose (Content-Disposition: attachment; filename*=UTF-8''...).
function fileNameOf(response: Response, fallback: string) {
  const header = response.headers.get("Content-Disposition") ?? ""
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  return encoded ? decodeURIComponent(encoded) : fallback
}

// "Statements Pack" on a bank account card: pick a financial year and download
// a zip of every statement uploaded for it - or, if some months have none, see
// which are missing. The server does the checking (lib/statements-pack.server.ts).
export function StatementsPackDialog({
  bankAccountId,
  onClose,
}: {
  bankAccountId: number
  onClose: () => void
}) {
  const { financialYearEndMonth, startingYear } = useCompanySettings()
  const years = useMemo(
    () => financialYears(financialYearEndMonth, startingYear),
    [financialYearEndMonth, startingYear],
  )
  const [year, setYear] = useState(String(years[0]?.endYear ?? ""))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Missing | null>(null)

  // allowMissing: the user has seen which months are missing and wants the
  // statements there are.
  async function download(allowMissing = false) {
    setBusy(true)
    setProblem(null)
    try {
      const response = await fetch(
        `/api/books/statements-pack?bankAccountId=${bankAccountId}&year=${year}${allowMissing ? "&allowMissing=1" : ""}`,
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as Partial<Missing> | null
        setProblem({
          problem: body?.problem ?? "Couldn't build the statements pack.",
          missing: body?.missing ?? [],
        })
        return
      }
      const blob = await response.blob()
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = fileNameOf(response, `statements FY${year}.zip`)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
      onClose()
    } catch {
      setProblem({ problem: "Couldn't reach the server. Try again.", missing: [] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Statements Pack</DialogTitle>
          <DialogDescription>
            Select the year you want to download all the statements for from the list below and then
            click the download button.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="statements-pack-year">Financial year</FieldLabel>
          <Select
            value={year}
            onValueChange={(value) => {
              setYear(value)
              setProblem(null)
            }}
            disabled={busy}
          >
            <SelectTrigger id="statements-pack-year" className="w-full">
              <SelectValue placeholder="Select a financial year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((fy) => (
                <SelectItem key={fy.endYear} value={String(fy.endYear)}>
                  {fy.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {problem ? (
          <div className="grid gap-2 text-sm text-destructive" role="alert">
            <p>
              {problem.missing.length > 0
                ? "Statements are missing for these months:"
                : problem.problem}
            </p>
            {problem.missing.length > 0 ? (
              <ul className="list-disc pl-5">
                {problem.missing.map((month) => (
                  <li key={month}>{month}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {problem && problem.missing.length > 0 ? (
            <Button type="button" disabled={busy} onClick={() => download(true)}>
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
              Download anyway
            </Button>
          ) : (
            <Button type="button" disabled={busy || year === ""} onClick={() => download()}>
              {busy ? <LoaderCircleIcon className="animate-spin" /> : <DownloadIcon />}
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
