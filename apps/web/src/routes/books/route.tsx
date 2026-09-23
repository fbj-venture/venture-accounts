import { auth } from '#/lib/auth.ts';
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
import { useBreadcrumbs } from './-breadcrumbs.ts';

const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  return await auth.api.getSession({ headers: getRequest().headers });
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
    return { user };
  },
  component: BooksLayout,
});

function BooksLayout() {
  const { user } = Route.useRouteContext();
  const crumbs = useBreadcrumbs();

  return (
    <SidebarProvider>
      <AppSidebar sessionUser={user} />
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


  );
}

/*
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b bg-muted-foreground px-6 py-3">
        <h1 className='flex gap-2 items-center text-2xl text-accent'>
          <Wallet2Icon className="size-7 text-primary" />
          <p>
            <span className="font-semibold">Venture</span>
            &nbsp;
            <span className="font-semibold text-primary">Accounts</span>
          </p>
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-accent" >{user.name}</span>
          <Button
            variant="link"
            size="sm"
            onClick={signout}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
*/