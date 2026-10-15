import { Checkbox } from "#/components/ui/checkbox.tsx"
import { Field, FieldLabel } from "#/components/ui/field.tsx"

// The archived filter is a tri-state checkbox: indeterminate shows everything,
// ticked only the archived rows, unticked only the active ones. Clicking
// cycles through the three.
export type ArchivedFilter = "all" | "archived" | "unarchived"

const NEXT_FILTER: Record<ArchivedFilter, ArchivedFilter> = {
  all: "archived",
  archived: "unarchived",
  unarchived: "all",
}

const FILTER_CHECKED = {
  all: "indeterminate",
  archived: true,
  unarchived: false,
} as const

const FILTER_LABEL: Record<ArchivedFilter, string> = {
  all: "Show: all",
  archived: "Show: archived only",
  unarchived: "Show: only unarchived",
}

export function matchesArchivedFilter(filter: ArchivedFilter, isArchived: boolean) {
  return filter === "all" || isArchived === (filter === "archived")
}

export function ArchivedFilterCheckbox({
  id,
  value,
  onValueChange,
}: {
  id: string
  value: ArchivedFilter
  onValueChange: (value: ArchivedFilter) => void
}) {
  return (
    <Field orientation="horizontal" className="w-fit">
      <Checkbox
        id={id}
        checked={FILTER_CHECKED[value]}
        onCheckedChange={() => onValueChange(NEXT_FILTER[value])}
      />
      <FieldLabel htmlFor={id}>{FILTER_LABEL[value]}</FieldLabel>
    </Field>
  )
}
