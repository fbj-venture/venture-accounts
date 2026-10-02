
export type SessionUser = {
   id: string;
   createdAt: Date;
   updatedAt: Date;
   email: string;
   emailVerified: boolean;
   name: string;
   image?: string | null | undefined;
   /** Set by better-auth's admin plugin; "admin" unlocks /books/admin. */
   role?: string | null | undefined;
};
