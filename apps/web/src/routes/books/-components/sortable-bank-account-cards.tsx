import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useRouter } from "@tanstack/react-router"
import { GripVerticalIcon } from "lucide-react"
import { useEffect, useState } from "react"
import {
  saveBankAccountOrder,
  type BankAccountBalance,
} from "../-server/bank-account-balances.server.ts"
import { clearBankAccountsCache } from "../banking/-server/bank-accounts-cache.ts"
import { BankAccountCard } from "./bank-account-card.tsx"
import { BankAccountMenu } from "./bank-account-menu.tsx"

// The dashboard's bank account cards, which the user can drag into their own
// order (saved per user). Only the grip handle starts a drag, so the card's
// menu and links keep working; the handle also works from the keyboard
// (focus it, then Space and the arrow keys).
export function SortableBankAccountCards({ bankAccounts }: { bankAccounts: BankAccountBalance[] }) {
  const router = useRouter()
  // Held locally so a dropped card stays put while the order saves.
  const [items, setItems] = useState(bankAccounts)
  useEffect(() => setItems(bankAccounts), [bankAccounts])
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) {
      return
    }
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    const next = arrayMove(items, from, to)
    setItems(next)
    setError(null)
    try {
      await saveBankAccountOrder({ data: { ids: next.map((item) => item.id) } })
      // The cached bank account list (used by the other pages' selectors) is in the old order.
      clearBankAccountsCache()
      await router.invalidate()
    } catch {
      setItems(items)
      setError("Couldn't save the new order. Please try again.")
    }
  }

  return (
    <>
      {error ? (
        <p role="alert" className="pb-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DndContext
        id="bank-account-cards"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
          {/* Stacked on mobile; from sm up the cards flow in rows and wrap. */}
          <div className="flex w-full flex-col gap-5 sm:flex-row sm:flex-wrap">
            {items.map((bankAccount) => (
              <SortableCard key={bankAccount.id} bankAccount={bankAccount} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </>
  )
}

function SortableCard({ bankAccount }: { bankAccount: BankAccountBalance }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bankAccount.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative grow sm:basis-72 ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`Reorder ${bankAccount.name}`}
        className="absolute top-3 right-3 z-10 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <BankAccountCard
        bankAccount={bankAccount}
        className="h-full transition-colors hover:border-primary **:data-[slot=card-title]:transition-colors hover:**:data-[slot=card-title]:text-primary"
        footer={<BankAccountMenu bankAccountId={bankAccount.id} />}
      />
    </div>
  )
}
