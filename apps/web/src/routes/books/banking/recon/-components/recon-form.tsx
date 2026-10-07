import { Button } from "#/components/ui/button.tsx";
import { Calendar } from "#/components/ui/calendar.tsx";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "#/components/ui/field.tsx";
import { Input } from "#/components/ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover.tsx";
import { useNavigate } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { saveRecon, type ReconForm as ReconFormData, type UploadSummary } from "./recon-fn.ts";
import { UploadPickerDialog } from "./upload-picker-dialog.tsx";

// Reconcile creates the reconciliation from these figures, or - when one was
// already started - saves them only if they've changed, then continues to
// its transactions. An opening balance taken from the take-on entry or the
// previous reconciliation stays fixed.
export function ReconForm({
  bankAccountId,
  initial,
}: {
  bankAccountId: number;
  initial: ReconFormData;
}) {
  const navigate = useNavigate();
  const openingBalanceDisabled = initial.openingBalanceLocked;
  const [opening, setOpening] = useState(initial.openingBalance?.toFixed(2) ?? "");
  const [closing, setClosing] = useState(initial.closingBalance?.toFixed(2) ?? "");
  const [statementDate, setStatementDate] = useState<Date | undefined>(
    initial.statementDate ? parseISO(initial.statementDate) : undefined,
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [upload, setUpload] = useState<UploadSummary | null>(initial.upload);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = opening.trim() !== "" && closing.trim() !== "" && statementDate !== undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !statementDate) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const figures = {
        bankAccountId,
        openingBalance: initial.openingBalanceLocked ? null : Number(opening),
        closingBalance: Number(closing),
        statementDate: format(statementDate, "yyyy-MM-dd"),
        bankUploadId: upload?.id ?? null,
      };
      const changed =
        initial.reconId === null ||
        figures.bankUploadId !== (initial.upload?.id ?? null) ||
        figures.statementDate !== initial.statementDate ||
        figures.closingBalance !== initial.closingBalance ||
        (!initial.openingBalanceLocked && figures.openingBalance !== initial.openingBalance);

      const reconId = changed ? (await saveRecon({ data: figures })).reconId : initial.reconId;
      await navigate({
        to: "/books/banking/recon/session/$id",
        params: { id: String(reconId) },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save the reconciliation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid max-w-sm gap-4" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="recon-statement-date">Statement ending date</FieldLabel>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                id="recon-statement-date"
                type="button"
                variant="outline"
                className="justify-start font-normal"
              >
                <CalendarIcon className="size-4" />
                {statementDate ? format(statementDate, "d MMM yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                selected={statementDate}
                defaultMonth={statementDate}
                onSelect={(selected) => {
                  setStatementDate(selected);
                  setDatePickerOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
        <Field>
          <FieldLabel htmlFor="recon-opening-balance">Opening balance</FieldLabel>
          <Input
            id="recon-opening-balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
            disabled={openingBalanceDisabled}
            required
          />
          {!openingBalanceDisabled && (
            <FieldDescription>
              This account has no opening balance yet - enter the statement's opening balance.
            </FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="recon-closing-balance">Closing balance</FieldLabel>
          <Input
            id="recon-closing-balance"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={closing}
            onChange={(event) => setClosing(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel>Uploaded statement</FieldLabel>
          <div className="flex items-center gap-2 text-sm">
            {upload ? (
              <>
                <span>{upload.description}</span>
                <Button type="button" variant="link" size="sm" onClick={() => setUpload(null)}>
                  Unlink
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">None linked.</span>
            )}
            <Button type="button" variant="link" size="sm" onClick={() => setPickerOpen(true)}>
              {upload ? "Change" : "Link to an uploaded statement"}
            </Button>
          </div>
          <UploadPickerDialog
            bankAccountId={bankAccountId}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            onSelect={setUpload}
          />
        </Field>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </FieldGroup>
      <Button type="submit" disabled={saving || !canSubmit}>
        {saving ? "Saving..." : "Reconcile"}
      </Button>
    </form>
  );
}
