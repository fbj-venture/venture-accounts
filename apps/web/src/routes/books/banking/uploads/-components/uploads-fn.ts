import { requireUser } from "#/lib/require-user.server.ts";
import { bankUpload, db, user } from "@app/db/direct";
import { getFileUrl } from "@app/storage";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";

// Keep ALL database and storage code inside handlers - see
// transactions/-components/transactions-fn.ts for why.

export type BankUploadRow = Awaited<ReturnType<typeof getBankUploads>>[number];

// The documents uploaded for one bank account (e.g. imported statement
// PDFs), newest first.
export const getBankUploads = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    await requireUser();
    return db
      .select({
        id: bankUpload.id,
        description: bankUpload.description,
        uploadedAt: bankUpload.createdAt,
        uploadedBy: user.name,
      })
      .from(bankUpload)
      .innerJoin(user, eq(user.id, bankUpload.createdBy))
      .where(eq(bankUpload.bankId, bankAccountId))
      .orderBy(desc(bankUpload.createdAt), desc(bankUpload.id));
  });

// A temporary download link for one upload. The bucket is private, so links
// are only made on request, for signed-in users, and expire after a few minutes.
export const getBankUploadUrl = createServerFn({ method: "POST" })
  .validator((uploadId: number) => uploadId)
  .handler(async ({ data: uploadId }) => {
    await requireUser();
    const [upload] = await db
      .select({ fileKey: bankUpload.fileUrl })
      .from(bankUpload)
      .where(eq(bankUpload.id, uploadId));
    if (!upload) {
      throw new Error("Upload not found.");
    }
    return { url: await getFileUrl(upload.fileKey) };
  });
