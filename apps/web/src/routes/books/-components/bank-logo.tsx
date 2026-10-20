import { cn } from "#/lib/utils.ts"

// A bank's logo (bank.logo, inline SVG markup) at 1rem square. An <img> data
// URI keeps each logo's own <style> classes (.st0 etc.) from leaking into the
// page or into another bank's logo.
export function BankLogo({
  logo,
  name,
  className,
}: {
  logo: string | null | undefined
  name?: string | null
  className?: string
}) {
  if (!logo) {
    return null
  }
  return (
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(logo)}`}
      alt={name ?? ""}
      className={cn("size-4 shrink-0 object-contain", className)}
    />
  )
}
