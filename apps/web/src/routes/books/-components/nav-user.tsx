import {
  BadgeCheck,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Sun,
  User as UserIcon
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#/components/ui/avatar.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "#/components/ui/sidebar.tsx";
import { useTheme, type Theme } from "#/hooks/use-theme.ts";
import { authClient } from "#/lib/auth-client";
import type { SessionUser } from "@app/models";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function NavUser({
  user,
}: {
  user: SessionUser;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const [theme, setTheme] = useTheme();
  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  // null: closed. Otherwise the progress of the reset email the dialog reports.
  const [passwordEmail, setPasswordEmail] = useState<
    null | { status: "sending" } | { status: "sent" } | { status: "error"; message: string }
  >(null);

  // Emails the signed-in user a link (to /set-password) to choose a new
  // password - the same email as "Forgot your password?", so it is throttled
  // the same way.
  const changePassword = async () => {
    setPasswordEmail({ status: "sending" });
    const { error } = await authClient.requestPasswordReset({
      email: user.email,
      redirectTo: "/set-password",
    });
    setPasswordEmail(
      error
        ? {
            status: "error",
            message:
              error.status === 429
                ? "Too many requests. Please wait a few minutes and try again."
                : (error.message ?? "Couldn't send the email."),
          }
        : { status: "sent" },
    );
  };

  const signout = async () => {
    await authClient.signOut();
    await navigate({ to: "/" });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  <UserIcon className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    <UserIcon className="size-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/books/account">
                  <BadgeCheck />
                  My Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={changePassword}>
                <KeyRound />
                Change Password
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <ThemeIcon className="size-4 text-muted-foreground" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={theme}
                  onValueChange={(value) => setTheme(value as Theme)}
                >
                  <DropdownMenuRadioItem value="light">
                    <Sun />
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    <Moon />
                    Dark
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">
                    <Monitor />
                    System
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signout}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <Dialog
        open={passwordEmail !== null}
        onOpenChange={(open) => !open && setPasswordEmail(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              {passwordEmail?.status === "sending"
                ? "Sending..."
                : passwordEmail?.status === "sent"
                  ? `We've emailed a link to ${user.email}. Follow it to choose a new password - it works for one hour.`
                  : passwordEmail?.status === "error"
                    ? passwordEmail.message
                    : null}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
