import { Button } from '#/components/ui/button.tsx';
import { Checkbox } from '#/components/ui/checkbox.tsx';
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
import { USER_ROLES, createUser } from './-components/users-fn.ts';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [requireVerification, setRequireVerification] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the user was created but their verification email wasn't sent.
  const [created, setCreated] = useState<{ id: string; emailError: string } | null>(null);

  const passwordTooShort = password !== '' && password.length < 8;
  const mismatch = confirmPassword !== '' && password !== confirmPassword;
  const canSubmit =
    !busy &&
    name.trim() !== '' &&
    email.trim() !== '' &&
    password.length >= 8 &&
    password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createUser({
        data: { name, email, password, confirmPassword, role, requireVerification },
      });
      if (result.verificationEmailError) {
        setCreated({ id: result.id, emailError: result.verificationEmailError });
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
            <span className="font-medium">{name.trim()}</span> was created, but their verification
            email couldn't be sent: <span className="text-destructive">{created.emailError}</span>
          </p>
          <p className="text-muted-foreground">
            They can't sign in until they've verified their email. A new link is sent each time they
            try to sign in, so once email is working they can simply try again.
          </p>
          <div>
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
          <Field>
            <FieldLabel htmlFor="new-user-password">Password</FieldLabel>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              aria-invalid={passwordTooShort}
              required
            />
            <FieldDescription className={passwordTooShort ? 'text-destructive' : undefined}>
              At least 8 characters.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="new-user-confirm-password">Confirm password</FieldLabel>
            <Input
              id="new-user-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              aria-invalid={mismatch}
              required
            />
            {mismatch ? (
              <FieldDescription className="text-destructive">
                The passwords don't match.
              </FieldDescription>
            ) : null}
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="new-user-require-verification"
              checked={requireVerification}
              onCheckedChange={(checked) => setRequireVerification(checked === true)}
            />
            <div className="grid gap-1">
              <FieldLabel htmlFor="new-user-require-verification">
                Require the user to verify their email address before they can sign in
              </FieldLabel>
              <FieldDescription>
                {requireVerification
                  ? 'They will be emailed a link, and can only sign in once they have followed it.'
                  : 'They can sign in straight away with the password above.'}
              </FieldDescription>
            </div>
          </Field>
        </FieldGroup>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={!canSubmit}>
            <UserPlusIcon />
            {busy ? 'Creating...' : 'Create user'}
          </Button>
        </div>
      </form>
    </>
  );
}
