import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog.tsx';
import { Button } from '#/components/ui/button.tsx';
import { ButtonGroup } from '#/components/ui/button-group.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Field, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx';
import { cn } from '#/lib/utils.ts';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute, notFound, useRouter } from '@tanstack/react-router';
import { format } from 'date-fns';
import { SaveIcon, Trash2Icon, UserCheckIcon, UserXIcon } from 'lucide-react';
import { useState } from 'react';
import {
  USER_ROLES,
  deactivateUser,
  deleteUser,
  getUser,
  reactivateUser,
  updateUser,
} from './-components/users-fn.ts';

export const Route = createFileRoute('/books/admin/users/$id')({
  loader: async ({ params }) => {
    const user = await getUser({ data: params.id });
    if (!user) {
      throw notFound();
    }
    return { user };
  },
  component: RouteComponent,
});

// The action buttons are plain outline buttons that only turn primary under
// the pointer (same hover as the Edit button on the users table).
const actionButton =
  'cursor-pointer hover:border-primary hover:bg-primary hover:text-primary-foreground dark:hover:bg-primary';

const formatDateTime = (date: Date) => format(date, 'd MMM yyyy, HH:mm');

function RouteComponent() {
  const router = useRouter();
  const { user: signedInUser } = Route.useRouteContext();
  const { user } = Route.useLoaderData();
  useSetBreadcrumbs([
    { title: 'Users', url: '/books/admin/users' },
    { title: user.name },
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [saved, setSaved] = useState(false);

  // A ban with an expiry date lapses on its own, so it only counts while
  // it's still in the future (same rule as the users table).
  const isEnabled = !user.banned || (user.banExpires !== null && user.banExpires <= new Date());
  const isSelf = user.id === signedInUser.id;

  // leaveTo: the action leaves nothing to show here (the user is gone, or
  // you've signed yourself out), so go there afterwards instead of reloading.
  async function change(action: () => Promise<void>, leaveTo?: '/' | '/books/admin/users') {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDialogOpen(false);
      setReason('');
      if (leaveTo) {
        await router.navigate({ to: leaveTo });
        return;
      }
      await router.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't change the user.");
    } finally {
      setBusy(false);
    }
  }

  // Roles to offer: the known ones, plus the user's current role if it's
  // something else, so the dropdown never shows blank.
  const roleOptions: string[] = USER_ROLES.includes(user.role as (typeof USER_ROLES)[number])
    ? [...USER_ROLES]
    : [user.role, ...USER_ROLES];
  const canSave = !busy && name.trim() !== '' && (name.trim() !== user.name || role !== user.role);

  const details: [string, string][] = [
    ['Email', user.email],
    ['Email verified', user.emailVerified ? 'Yes' : 'No'],
    ['Status', isEnabled ? 'Active' : 'Deactivated'],
    ...(!isEnabled && user.banReason
      ? [['Deactivation reason', user.banReason] as [string, string]]
      : []),
    ...(!isEnabled && user.banExpires
      ? [['Deactivated until', formatDateTime(user.banExpires)] as [string, string]]
      : []),
    ['Created', formatDateTime(user.createdAt)],
    ['Last updated', formatDateTime(user.updatedAt)],
  ];

  return (
    <>
      <h2 className="pb-2">{user.name}</h2>
      <ButtonGroup className="mb-2">
        <Button
          type="submit"
          form="user-form"
          variant="outline"
          className={actionButton}
          disabled={!canSave}
        >
          <SaveIcon />
          {busy ? 'Saving...' : 'Save'}
        </Button>
        {isEnabled ? (
          <AlertDialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setReason('');
                setError(null);
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="outline" className={actionButton} disabled={busy}>
                <UserXIcon />
                Deactivate user
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deactivate {user.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  They will be signed out straight away and won't be able to sign in until you
                  reactivate them.
                  {isSelf
                    ? " This is your own account: you'll be signed out now, and if no other administrator can reactivate you, you'll be locked out."
                    : ''}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor="deactivate-reason">Reason</FieldLabel>
                <Input
                  id="deactivate-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why is this account being deactivated?"
                  required
                />
              </Field>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={busy || reason.trim() === ''}
                  onClick={() =>
                    change(
                      () => deactivateUser({ data: { id: user.id, reason: reason.trim() } }),
                      isSelf ? '/' : undefined,
                    )
                  }
                >
                  Deactivate
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            variant="outline"
            className={actionButton}
            disabled={busy}
            onClick={() => change(() => reactivateUser({ data: user.id }))}
          >
            <UserCheckIcon />
            Reactivate user
          </Button>
        )}
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) {
              setError(null);
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className={actionButton}
              disabled={busy || isSelf}
              title={isSelf ? "You can't delete your own account." : undefined}
            >
              <Trash2Icon />
              Delete user
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the user, along with their sign-in details and sessions.
                It can't be undone. To only stop them signing in, deactivate them instead.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => change(() => deleteUser({ data: user.id }), '/books/admin/users')}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ButtonGroup>
      {saved ? <p className="mb-2 text-sm text-muted-foreground">Saved.</p> : null}
      {error && !dialogOpen && !deleteOpen ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Card className="mt-4 max-w-lg">
        <CardHeader>
          <CardTitle>User details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form
            id="user-form"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSave) {
                return;
              }
              change(async () => {
                await updateUser({ data: { id: user.id, name: name.trim(), role } });
                setName(name.trim());
                setSaved(true);
              });
            }}
          >
            <Field>
              <FieldLabel htmlFor="user-name">Name</FieldLabel>
              <Input
                id="user-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-role">Role</FieldLabel>
              <Select
                value={role}
                onValueChange={(next) => {
                  setRole(next);
                  setSaved(false);
                }}
              >
                <SelectTrigger id="user-role" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((option) => (
                    <SelectItem key={option} value={option} className="capitalize">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </form>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd
                  className={cn(label === 'Deactivation reason' && 'font-medium text-destructive')}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </>
  );
}
