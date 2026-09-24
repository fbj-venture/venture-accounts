import { Button } from "#/components/ui/button.tsx";
import { Input } from "#/components/ui/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "#/components/ui/popover.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs.tsx";
import { cn } from "cn";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

export type AccountOption = {
  id: number;
  name: string;
  /** Parent account's name, for sub-accounts (e.g. "Charitable giving"). */
  parentName?: string | null;
  /** Bank account number, for Banks - shown in parentheses after the name. */
  accountNumber?: string | null;
  /** Account Type name (e.g. "Expense") - the list is grouped under these. */
  accountType?: string | null;
};

export type AccountOptions = {
  /** Income/expense etc. ledger accounts - "categories" in the UI. */
  categories: AccountOption[];
  /** Accounts backed by a real bank account - picking one is a transfer. */
  banks: AccountOption[];
};

type Tab = keyof AccountOptions;

// Shared picker for the ledger account something posts to: a search box
// filtering whichever tab (Categories / Banks) is showing.
export function AccountSelector({
  options,
  value,
  onValueChange,
  className,
}: {
  options: AccountOptions;
  value: number | null;
  onValueChange: (accountId: number) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("categories");

  const selected = useMemo(
    () => [...options.categories, ...options.banks].find((option) => option.id === value),
    [options, value],
  );

  function select(accountId: number) {
    onValueChange(accountId);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          aria-label="Account"
          className={cn("w-[200px] justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : "Select account"}
          </span>
          <ChevronsUpDownIcon className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${tab}...`}
            aria-label="Search accounts"
            className="h-8 pl-8"
          />
        </div>
        <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="banks">Banks</TabsTrigger>
          </TabsList>
          {(["categories", "banks"] as const).map((key) => (
            <TabsContent key={key} value={key}>
              <AccountList
                options={options[key]}
                search={search}
                value={value}
                onSelect={select}
              />
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

function AccountList({
  options,
  search,
  value,
  onSelect,
}: {
  options: AccountOption[];
  search: string;
  value: number | null;
  onSelect: (accountId: number) => void;
}) {
  // Matches on the parent name too, so searching "charitable" also finds
  // its sub-accounts - and on the account number, for Banks.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return options;
    }
    return options.filter((option) =>
      `${option.parentName ?? ""} ${option.name} ${option.accountNumber ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [options, search]);

  const groups = useMemo(() => groupByAccountType(filtered), [filtered]);

  if (filtered.length === 0) {
    return <div className="px-2 py-6 text-center text-sm text-muted-foreground">No accounts found.</div>;
  }

  return (
    <div role="listbox" className="max-h-64 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.accountType ?? ""} role="group" aria-label={group.accountType ?? undefined}>
          {group.accountType && (
            <div className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground underline underline-offset-2">
              {group.accountType}
            </div>
          )}
          {group.options.map((option) => (
            <div key={option.id} role="option" aria-selected={option.id === value}>
              <button
                type="button"
                onClick={() => onSelect(option.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate">
                  {option.parentName && (
                    <span className="text-muted-foreground">{option.parentName} › </span>
                  )}
                  {option.name}
                  {option.accountNumber && (
                    <span className="text-muted-foreground"> ({option.accountNumber})</span>
                  )}
                </span>
                <CheckIcon className={cn("size-4", option.id !== value && "invisible")} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Groups keep the order in which each type first appears, so the caller
// decides the type order (e.g. Expense, Income, Equity, Liability, Asset).
// Options without an accountType form one group with no heading.
function groupByAccountType(options: AccountOption[]) {
  const groups = new Map<string | null, AccountOption[]>();
  for (const option of options) {
    const key = option.accountType ?? null;
    const group = groups.get(key);
    if (group) {
      group.push(option);
    } else {
      groups.set(key, [option]);
    }
  }
  return [...groups].map(([accountType, groupOptions]) => ({
    accountType,
    options: groupOptions,
  }));
}
