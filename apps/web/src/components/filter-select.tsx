import { Button } from "#/components/ui/button.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover.tsx"
import { cn } from "cn"
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"

export type FilterSelectOption = { value: string; label: string }

// A drop-down with a filter box at the top of its list, for choices too long
// to scan. The filter matches anywhere in an option's label, ignoring case.
export function FilterSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder,
  filterPlaceholder = "Filter...",
  invalid,
  className,
}: {
  id?: string
  options: FilterSelectOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  filterPlaceholder?: string
  /** Marks the drop-down as having a problem (red border). */
  invalid?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")

  const selected = options.find((option) => option.value === value)
  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options
  }, [options, filter])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setFilter("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid ? true : undefined}
          className={cn(
            "w-full justify-between font-normal aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            onKeyDown={(event) => {
              // Enter picks the only match, so typing then Enter is enough.
              if (event.key === "Enter") {
                event.preventDefault()
                if (shown.length === 1) {
                  onValueChange(shown[0]!.value)
                  setOpen(false)
                  setFilter("")
                }
              }
            }}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            autoComplete="off"
            autoFocus
            className="h-8 pl-8"
          />
        </div>
        {shown.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nothing matches.
          </div>
        ) : (
          <div role="listbox" className="mt-2 max-h-64 overflow-y-auto">
            {shown.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onValueChange(option.value)
                  setOpen(false)
                  setFilter("")
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <CheckIcon className={cn("size-4", option.value !== value && "invisible")} />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
