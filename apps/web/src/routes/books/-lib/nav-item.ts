import type { LinkProps } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"

/** A route of the app, checked against the router's route tree. */
type NavUrl = NonNullable<LinkProps["to"]>

/** A link inside a sidebar menu category. */
export type NavSubItem = {
  title: string
  icon?: LucideIcon
  url: NavUrl
}

/**
 * A sidebar menu entry: either a category with links under it (`items`) or a
 * plain link of its own (`url`).
 */
export type NavItem = {
  title: string
  icon?: LucideIcon
  isActive?: boolean
  url?: NavUrl
  items?: NavSubItem[]
}
