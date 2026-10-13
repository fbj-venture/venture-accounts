import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx";
import { APP_INFO } from "#/lib/app-info.ts";

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const published = APP_INFO.publishedAt
    ? new Date(APP_INFO.publishedAt).toLocaleString("en-ZA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Johannesburg",
      })
    : "Not published (development build)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{APP_INFO.name}</DialogTitle>
          <DialogDescription>{APP_INFO.description}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Version</dt>
          <dd>{APP_INFO.version}</dd>
          <dt className="text-muted-foreground">Published</dt>
          <dd>{published}</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
