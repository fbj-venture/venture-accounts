import { Button } from "#/components/ui/button.tsx";
import { Calendar } from "#/components/ui/calendar.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#/components/ui/dialog.tsx";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover.tsx";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { setOpeningBalance } from "../../-components/bank-accounts-fn.ts";

const DEFAULT_NOTE = "Opening Balance Equity";

// The Button that opens this is only shown once getOpeningBalance (see
// ../../-components/bank-accounts-fn.ts) confirms the account has none yet.
export function OpeningBalanceDialog({
  accountId,
  onSaved,
}: {
  accountId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDate(undefined);
    setNote(DEFAULT_NOTE);
    setAmount("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || !note.trim() || amount.trim() === "") {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await setOpeningBalance({
        data: { accountId, date, note: note.trim(), amount: Number(amount) },
      });
      setOpen(false);
      reset();
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't set the opening ballance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="link">Set opening ballance</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set opening ballance</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="opening-balance-date">Date</FieldLabel>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="opening-balance-date"
                    type="button"
                    variant="outline"
                    className="justify-start font-normal"
                  >
                    <CalendarIcon className="size-4" />
                    {date ? format(date, "d MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    captionLayout="dropdown"
                    selected={date}
                    onSelect={(selected) => {
                      setDate(selected);
                      setDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </Field>
            <Field>
              <FieldLabel htmlFor="opening-balance-note">Note</FieldLabel>
              <Input
                id="opening-balance-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="opening-balance-amount">Amount</FieldLabel>
              <Input
                id="opening-balance-amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </Field>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={saving || !date || amount.trim() === ""}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
