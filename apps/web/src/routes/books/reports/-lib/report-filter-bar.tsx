import { MultiSelect } from "#/components/multi-select.tsx"
import { TableDateRange } from "#/components/table-date-range.tsx"
import { Button } from "#/components/ui/button.tsx"
import { Checkbox } from "#/components/ui/checkbox.tsx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select.tsx"
import { useCompanySettings } from "#/lib/company-settings.ts"
import { currentFinancialYear, financialYears } from "#/lib/financial-year.ts"
import { useStartingYear } from "#/lib/starting-year.ts"
import { yearsFromStart } from "#/lib/years.ts"
import { accountTypesQuery } from "#/routes/books/accounts/-lib/accounts-queries.ts"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ChevronDownIcon,
  FileDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlayIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import type { ReportFilters } from "./report-rows.ts"

/** The filters a report was run with. */
export type AppliedFilters = ReportFilters & { range: DateRange | undefined }

// The Account Types a report starts out showing.
const DEFAULT_TYPES = ["Expense", "Income"]

// The date range starts out on the current financial year.
function thisFinancialYear(endMonth: number): DateRange {
  const { from, to } = currentFinancialYear(endMonth)
  return { from, to }
}

// The filters and Export menu shared by the reports. The controls only edit a
// draft; the report changes once "Run" commits it through onRun. The route
// loader must have loaded accountTypesQuery.
export function ReportFilterBar({
  idPrefix,
  onRun,
  canExport,
  exporting,
  onExportExcel,
}: {
  /** Makes the controls' ids unique to the report. */
  idPrefix: string
  onRun: (filters: AppliedFilters) => void
  canExport: boolean
  exporting: boolean
  onExportExcel: () => void
}) {
  const startingYear = useStartingYear()
  const years = useMemo(() => yearsFromStart(startingYear), [startingYear])
  const { financialYearEndMonth } = useCompanySettings()
  const fiscalYears = useMemo(
    () => financialYears(financialYearEndMonth, startingYear),
    [financialYearEndMonth, startingYear],
  )
  const { data: accountTypes } = useSuspenseQuery(accountTypesQuery)

  const [range, setRange] = useState<DateRange | undefined>(() =>
    thisFinancialYear(financialYearEndMonth),
  )
  const [typeIds, setTypeIds] = useState<number[]>(() =>
    accountTypes.filter((type) => DEFAULT_TYPES.includes(type.name)).map((type) => type.id),
  )
  const [showArchived, setShowArchived] = useState(false)
  // The financial year the draft range is exactly, if it is one.
  const draftFinancialYear = fiscalYears.find(
    (year) =>
      range?.from?.getTime() === year.from.getTime() && range.to?.getTime() === year.to.getTime(),
  )
  const typeChoices = useMemo(
    () => accountTypes.map((type) => ({ value: type.id, label: type.name })),
    [accountTypes],
  )

  return (
    <div className="mt-2 flex items-end gap-4">
      <Field className="max-w-xs">
        <FieldLabel htmlFor={`${idPrefix}-types`}>Account types</FieldLabel>
        <MultiSelect
          id={`${idPrefix}-types`}
          options={typeChoices}
          value={typeIds}
          onValueChange={setTypeIds}
          placeholder="All account types"
        />
      </Field>
      <Field className="w-fit">
        <FieldLabel htmlFor={`${idPrefix}-financial-year`}>Financial year</FieldLabel>
        <Select
          value={draftFinancialYear ? String(draftFinancialYear.endYear) : ""}
          onValueChange={(endYear) => {
            const year = fiscalYears.find((candidate) => String(candidate.endYear) === endYear)
            if (year) setRange({ from: year.from, to: year.to })
          }}
        >
          <SelectTrigger id={`${idPrefix}-financial-year`} className="w-[260px]">
            <SelectValue placeholder="Custom range" />
          </SelectTrigger>
          <SelectContent>
            {fiscalYears.map((year) => (
              <SelectItem key={year.endYear} value={String(year.endYear)}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field className="w-fit">
        <FieldLabel>Date range</FieldLabel>
        <TableDateRange range={range} onRangeChange={setRange} years={years} />
      </Field>
      <div className="flex h-9 items-center">
        <Field orientation="horizontal" className="w-fit">
          <Checkbox
            id={`${idPrefix}-archived`}
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(checked === true)}
          />
          <FieldLabel htmlFor={`${idPrefix}-archived`}>Show archived accounts</FieldLabel>
        </Field>
      </div>
      <Button type="button" onClick={() => onRun({ range, typeIds, showArchived })}>
        <PlayIcon />
        Run
      </Button>
      {/* PDF is still a stub. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="ml-auto"
            disabled={!canExport || exporting}
          >
            <FileDownIcon />
            {exporting ? "Exporting..." : "Export"}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            <FileTextIcon />
            PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onExportExcel}>
            <FileSpreadsheetIcon />
            Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
