import { useSidebarOpen } from "#/hooks/use-sidebar-open.ts"
import { CompanySettingsContext } from "#/lib/company-settings.ts"
import { AppSidebar } from "#/routes/books/-components/app-sidebar.tsx"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import type { SessionUser } from "@app/models"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { Fragment } from "react"
import { useBreadcrumbs } from "./-lib/breadcrumbs.ts"
import { sessionQuery } from "./-lib/session-query.ts"
import { companySettingsQuery } from "./admin/company/-lib/company-queries.ts"

export const Route = createFileRoute("/books")({
  beforeLoad: async ({ context }) => {
    const authSession = await context.queryClient.ensureQueryData(sessionQuery)
    if (!authSession) {
      throw redirect({ to: "/" })
    }
    if ("pending" in authSession) {
      throw redirect({ to: "/second-factor" })
    }
    // Explicit annotation so this fails to typecheck if better-auth's
    // inferred user shape ever drifts from @app/models' User.
    const user: SessionUser = authSession.user
    // Fills the cache for every page under /books: the settings are never
    // stale, only invalidated when the Company Settings are saved.
    await context.queryClient.ensureQueryData(companySettingsQuery)
    return {
      user,
      sidebarOpen: authSession.sidebarOpen,
      navSections: authSession.navSections,
    }
  },
  component: BooksLayout,
})

function BooksLayout() {
  const { user, appCompany, sidebarOpen: savedSidebarOpen, navSections } = Route.useRouteContext()
  const { data: companySettings } = useSuspenseQuery(companySettingsQuery)
  const crumbs = useBreadcrumbs()
  // Expanded or collapsed, remembered between pages and sign-ins.
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen(savedSidebarOpen)

  return (
    <CompanySettingsContext.Provider value={companySettings}>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar sessionUser={user} appCompany={appCompany} navSections={navSections} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  {crumbs.map((crumb, index) => (
                    <Fragment key={crumb.title}>
                      {index > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
                      <BreadcrumbItem
                        className={index < crumbs.length - 1 ? "hidden md:block" : undefined}
                      >
                        {index === crumbs.length - 1 || !crumb.url ? (
                          <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={crumb.url}>{crumb.title}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className=" px-5 py-2">
            <Outlet />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </CompanySettingsContext.Provider>
  )
}
