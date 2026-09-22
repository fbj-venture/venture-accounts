"use client";

import {
  GaugeIcon,
  ImportIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  ListPlusIcon,
  UsersRoundIcon,
  Wallet2Icon
} from "lucide-react";
import * as React from "react";

import { NavPlatform } from "#/components/nav-main.tsx";
import { NavUsers } from "#/components/nav-projects.tsx";
import { NavUser } from "#/components/nav-user.tsx";
import { TeamSwitcher } from "#/components/team-switcher.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "#/components/ui/sidebar.tsx";

// This is sample data.
const data = {
  user: {
    name: "Francis",
    email: "francis@venturechurch.co.za",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Venture Church",
      logo: Wallet2Icon,
      plan: "Accounts",
    },
  ],
  platform: [
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
          title: "Unassigned Transactions",
          icon: ListPlusIcon,
          url: "#"
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
          url: "#",
        },
      ],
    }
  ],
  admin: [
    {
      name: "List Users",
      url: "#",
      icon: UsersRoundIcon
    }
  ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavPlatform items={data.platform} />
        <NavUsers users={data.admin} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
