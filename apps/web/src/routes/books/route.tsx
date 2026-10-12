import { auth } from '#/lib/auth.ts';
import { APP_COMPANY } from '#/lib/app-company.ts';
import { sidebarOpenFromCookieHeader, useSidebarOpen } from '#/hooks/use-sidebar-open.ts';
import { getOrCreateSettings } from '#/lib/app-settings.server.ts';
import { StartingYearContext } from '#/lib/starting-year.ts';
import { AppSidebar } from "#/routes/books/-components/app-sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar";
import type { SessionUser } from '@app/models';
import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { Fragment } from 'react';
import { useBreadcrumbs } from './-components/breadcrumbs.ts';

// The signed-in user and their app settings, in one round trip. The settings
// row is created with its default values the first time a user gets here
// after signing in (see getOrCreateSettings), then read like any other.
const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  const authSession = await auth.api.getSession({ headers: getRequest().headers });
  if (!authSession) {
    return null;
  }
  const { startingYear } = await getOrCreateSettings(authSession.user.id);
  // The sidebar's saved position comes with the cookie the browser sent, so
  // the page is drawn that way from the first paint (see use-sidebar-open.ts).
  const sidebarOpen = sidebarOpenFromCookieHeader(getRequest().headers.get('cookie'));
  return { user: authSession.user, startingYear, sidebarOpen };
});

export const Route = createFileRoute('/books')({
  beforeLoad: async () => {
    const authSession = await getAuthSession();
    if (!authSession) {
      throw redirect({ to: '/' });
    }
    // Explicit annotation so this fails to typecheck if better-auth's
    // inferred user shape ever drifts from @app/models' User.
    const user: SessionUser = authSession.user;
    return {
      user,
      appCompany: APP_COMPANY,
      startingYear: authSession.startingYear,
      sidebarOpen: authSession.sidebarOpen,
    };
  },
  component: BooksLayout,
});

function BooksLayout() {
  const { user, appCompany, startingYear, sidebarOpen: savedSidebarOpen } = Route.useRouteContext();
  const crumbs = useBreadcrumbs();
  // Expanded or collapsed, remembered between pages and sign-ins.
  const [sidebarOpen, setSidebarOpen] = useSidebarOpen(savedSidebarOpen);

  return (
    <StartingYearContext.Provider value={startingYear}>
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar sessionUser={user} appCompany={appCompany} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {crumbs.map((crumb, index) => (
                  <Fragment key={crumb.title}>
                    {index > 0 ? (
                      <BreadcrumbSeparator className="hidden md:block" />
                    ) : null}
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
    </StartingYearContext.Provider>
  );
}
