"use client";

import {
  GaugeIcon,
  ImportIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListPlusIcon,
  ListTodoIcon,
  SearchIcon,
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
import type { SessionUser } from "@app/models";
import { AboutDialog } from "./about-dialog.tsx";
import { NavAccounts } from "./nav-main.tsx";
import { NavUsers } from "./nav-projects.tsx";
import { NavUser } from "./nav-user.tsx";

// This is sample data.
const data = {
  accounts: [
    {
      title: "Accounts",
      url: "#",
      icon: GaugeIcon,
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
          url: "/books/banking/search/"
        },
        {
          title: "Post Transactions",
          icon: ListPlusIcon,
          url: "/books/banking/transactions/"
        },
        {
          title: "Bank Account Recon",
          icon: ListTodoIcon,
          url: "/books/banking/recon/"
        },
      ],
    },
    {
      title: "Banking",
      url: "#",
      isActive: true,
      icon: LandmarkIcon,
      items: [
        {
          title: "Import",
          icon: ImportIcon,
          url: "/books/banking/import/",
        },
      ],
    }
  ],
  admin: [
    {
      name: "Users",
      url: "/books/admin/users/",
      icon: UsersRoundIcon
    }
  ]
};

export function AppSidebar({
  sessionUser,
  appCompany,
  ...props
}: React.ComponentProps<typeof Sidebar> & { sessionUser: SessionUser; appCompany: string; }) {
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
        <NavAccounts items={data.accounts} />
        {sessionUser.role === "admin" && <NavUsers users={data.admin} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sessionUser} />
      </SidebarFooter>
      <SidebarRail />
      {isAdmin && <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />}
    </Sidebar>
  );
}

/*
        <TeamSwitcher teams={data.teams} />
 */