import { Button } from '#/components/ui/button.tsx';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { USER_ROLES, createUser, sendUserInvitation } from './-components/users-fn.ts';

// A static "new" segment outranks the dynamic $id route, so this is matched
// before $id.tsx.
export const Route = createFileRoute('/books/admin/users/new')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  useSetBreadcrumbs([
    { title: 'Users', url: '/books/admin/users' },
    { title: 'New user' },
  ]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('user');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the user was created but their invitation email wasn't sent.
  const [created, setCreated] = useState<{ id: string; emailError: string } | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | string>('idle');

  const canSubmit = !busy && name.trim() !== '' && email.trim() !== '';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createUser({
        data: { name, email, role },
      });
      if (result.invitationEmailError) {
        setCreated({ id: result.id, emailError: result.invitationEmailError });
        return;
      }
      await navigate({ to: '/books/admin/users/$id', params: { id: result.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't create the user.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <>
        <h2 className="pb-2">New user</h2>
        <div className="grid max-w-md gap-3 text-sm">
          <p>
            <span className="font-medium">{name.trim()}</span> was created, but their invitation
            email couldn't be sent: <span className="text-destructive">{created.emailError}</span>
          </p>
          <p className="text-muted-foreground">
            They can't sign in until they've chosen a password from the invitation link.
          </p>
          {resend !== 'idle' && resend !== 'sending' && resend !== 'sent' ? (
            <p className="text-destructive" role="alert">
              {resend}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={resend === 'sending' || resend === 'sent'}
              onClick={async () => {
                setResend('sending');
                try {
                  await sendUserInvitation({ data: created.id });
                  setResend('sent');
                } catch (caught) {
                  setResend(caught instanceof Error ? caught.message : "Couldn't send the email.");
                }
              }}
            >
              {resend === 'sending' ? 'Sending...' : resend === 'sent' ? 'Invitation sent' : 'Send invitation again'}
            </Button>
            <Button asChild variant="outline">
              <Link to="/books/admin/users/$id" params={{ id: created.id }}>
                View user
              </Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="pb-2">New user</h2>
      <form className="grid max-w-md gap-6" onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="new-user-name">Name</FieldLabel>
            <Input
              id="new-user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-role">Role</FieldLabel>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="new-user-role" className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((option) => (
                  <SelectItem key={option} value={option} className="capitalize">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <FieldDescription>
            They will be emailed an invitation with a link to choose their own password.
          </FieldDescription>
        </FieldGroup>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={!canSubmit}>
            <UserPlusIcon />
            {busy ? 'Creating...' : 'Create user and send invitation'}
          </Button>
        </div>
      </form>
    </>
  );
}
