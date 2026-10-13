"use client";

import {
  BoxesIcon,
  HomeIcon,
  ImportIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListPlusIcon,
  ListTodoIcon,
  LogsIcon,
  SearchIcon,
  SummaryIcon,
  UsersRoundIcon,
  Wallet2Icon
} from "lucide-react";
import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "#/components/ui/sidebar.tsx";
import type { NavSectionsOpen } from "#/hooks/use-nav-sections-open.ts";
import type { SessionUser } from "@app/models";
import type { NavItem } from "../-lib/nav-item.ts";
import { AboutDialog } from "./about-dialog.tsx";
import { NavAccounts } from "./nav-main.tsx";
import { NavUsers } from "./nav-projects.tsx";
import { NavUser } from "./nav-user.tsx";

// This is sample data.
const mainNav: NavItem[] = [
  {
    title: "Home",
    icon: HomeIcon,
    isActive: true,
    items: [
      {
        title: "Dashboard",
        icon: LayoutDashboardIcon,
        url: "/books"
      },
      {
        title: "Find Transactions",
        icon: SearchIcon,
        url: "/books/banking/search"
      },
      {
        title: "Post Transactions",
        icon: ListPlusIcon,
        url: "/books/banking/transactions"
      },
      {
        title: "Bank Account Recon",
        icon: ListTodoIcon,
        url: "/books/banking/recon"
      },
      
    ],
  },
  {
    title: "Banking",
    isActive: true,
    icon: LandmarkIcon,
    items: [
      {
        title: "Import Documents",
        icon: ImportIcon,
        url: "/books/banking/import",
      },
    ],
  },
  {
    title:"Manage",
    isActive: false,
    icon: LogsIcon,
    items: [
      {
        title: "Accounts List",
        icon: BoxesIcon,
        url: "/books/accounts"
      },
      {
        title:"Bank Accounts",
        icon: LandmarkIcon,
        url: "/books/bank-account"
      }
    ]
  },
  {
    title: "Reports",
    isActive: false,
    icon: SummaryIcon,
    items: [],
  }
];

const adminNav: NavItem[] = [
  {
    title: "Users",
    url: "/books/admin/users",
    icon: UsersRoundIcon
  }
];

export function AppSidebar({
  sessionUser,
  appCompany,
  navSections,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessionUser: SessionUser;
  appCompany: string;
  /** Which nav sections are open, as the server read them from the cookie. */
  navSections: NavSectionsOpen;
}) {
  const [aboutOpen, setAboutOpen] = React.useState(false);
  const isAdmin = sessionUser.role === "admin";
  const title = (
    <>
      <Wallet2Icon className="size-7 shrink-0 text-primary" />
      <span className="pl-2 group-data-[collapsible=icon]:hidden">
        <span className="font-semibold text-muted-foreground">{appCompany}</span>
        &nbsp;
        <span className="font-semibold text-primary">Accounts</span>
      </span>
    </>
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <h1>
          {isAdmin ? (
            <button
              type="button"
              className="flex cursor-pointer items-center"
              onClick={() => setAboutOpen(true)}
            >
              {title}
            </button>
          ) : (
            <span className="flex items-center">{title}</span>
          )}
        </h1>
      </SidebarHeader>
      <SidebarContent>
        <NavAccounts items={mainNav} savedSections={navSections} />
        {sessionUser.role === "admin" && <NavUsers users={adminNav} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sessionUser} />
      </SidebarFooter>
      <SidebarRail />
      {isAdmin && <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />}
    </Sidebar>
  );
}
