import { ChevronRight, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "#/components/ui/sidebar.tsx";

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: {
    title: string;
    icon?: LucideIcon;
    url: string;
  }[];
};

// How long the menu stays open after the pointer leaves, so it can cross the
// small gap between the icon and the menu.
const HOVER_CLOSE_DELAY_MS = 150;

// A collapsed sidebar shows only each category's icon. Hovering one opens this
// menu beside it: the category as a heading (not selectable) and every item in
// it, with its icon.
function CollapsedCategoryMenu({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hideSoon = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <SidebarMenuItem>
      {/* modal={false}: no focus trap or blocked page while it's only a hover menu. */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            onPointerEnter={show}
            onPointerLeave={hideSoon}
            // Hovering already opened it; a click must not toggle it shut again.
            // (The keyboard still opens and closes it.)
            onPointerDown={(event) => event.preventDefault()}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          onPointerEnter={show}
          onPointerLeave={hideSoon}
          // Leave focus where it was rather than jumping back to the icon.
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
            {item.icon && <item.icon className="size-4" />}
            {item.title}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items?.map((subItem) => (
            <DropdownMenuItem key={subItem.title} asChild>
              <a href={subItem.url}>
                {subItem.icon && <subItem.icon />}
                {subItem.title}
              </a>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

export function NavAccounts({ items }: { items: NavItem[] }) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) =>
          collapsed ? (
            <CollapsedCategoryMenu key={item.title} item={item} />
          ) : (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild>
                        <a href={subItem.url}>
                          {subItem.icon && <subItem.icon />}
                          <span>{subItem.title}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
          ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
