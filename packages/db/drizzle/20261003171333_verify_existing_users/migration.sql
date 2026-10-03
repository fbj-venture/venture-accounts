-- Email verification is now required to sign in. Everyone who exists at this
-- point was created by an administrator and has been signing in without it,
-- so mark them verified rather than lock them out.
UPDATE "auth"."user" SET "email_verified" = true WHERE "email_verified" = false;
