import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar.tsx';
import { Button } from '#/components/ui/button.tsx';
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card.tsx';
import { Field, FieldDescription, FieldLabel } from '#/components/ui/field.tsx';
import { Input } from '#/components/ui/input.tsx';
import { useSetBreadcrumbs } from '#/routes/books/-components/breadcrumbs';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { SaveIcon, UserIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { updateMyProfile } from './-components/my-account-fn.ts';

export const Route = createFileRoute('/books/admin/users/me')({
  component: RouteComponent,
});

const AVATAR_SIZE = 128;

// Centre-crops the picked picture to a square and shrinks it to a small JPEG
// data URL, so what's stored stays a few kilobytes whatever the original.
async function toAvatarDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error("Couldn't process the image.");
    }
    context.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE,
      AVATAR_SIZE,
    );
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function RouteComponent() {
  const router = useRouter();
  const { user } = Route.useRouteContext();
  useSetBreadcrumbs([{ title: 'Users', url: '/books/admin/users' }, { title: 'My Account' }]);

  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState<string | null>(user.image ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canSave =
    !busy && name.trim() !== '' && (name.trim() !== user.name || image !== (user.image ?? null));

  async function pickAvatar(file: File | undefined) {
    if (!file) {
      return;
    }
    setError(null);
    try {
      setImage(await toAvatarDataUrl(file));
      setSaved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That file couldn't be used as a picture.");
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateMyProfile({ data: { name: name.trim(), image } });
      setName(name.trim());
      setSaved(true);
      // Re-reads the session so the sidebar shows the new name and avatar.
      await router.invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save your details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="pb-2">My Account</h2>
      <Card className="mt-4 max-w-lg">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={save}>
            <div className="flex items-center gap-4">
              <Avatar className="size-20">
                <AvatarImage src={image ?? undefined} alt={name} />
                <AvatarFallback>
                  <UserIcon className="size-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    pickAvatar(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  {image ? 'Change avatar' : 'Set avatar'}
                </Button>
                {image ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setImage(null);
                      setSaved(false);
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="my-name">Name</FieldLabel>
              <Input
                id="my-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="my-email">Email</FieldLabel>
              <Input id="my-email" value={user.email} disabled />
              <FieldDescription>
                Your email is your login, so it can't be changed here.
              </FieldDescription>
            </Field>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
            <div>
              <Button type="submit" disabled={!canSave}>
                <SaveIcon />
                {busy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
