import { Input } from "#/components/ui/input.tsx"
import { cn } from "cn"
import { XIcon } from "lucide-react"
import type * as React from "react"

// A search box with a clear button inside it, shown while there is text. The
// browser's own clear button is hidden so there is only one.
export function SearchInput({
  value,
  onValueChange,
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string
  onValueChange: (value: string) => void
  /** Extra classes for the text box itself (className sizes the wrapper). */
  inputClassName?: string
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("pr-9 [&::-webkit-search-cancel-button]:appearance-none", inputClassName)}
      />
      {value === "" ? null : (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onValueChange("")}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
