import { requireUser } from "#/lib/require-user.server.ts"
import { bankUpload, db, recon, user, withUpdate } from "@app/db/direct"
import { getFileUrl } from "@app/storage"
import { createServerFn } from "@tanstack/react-start"
import { asc, desc, eq } from "drizzle-orm"

// Keep ALL database and storage code inside handlers - see
// transactions/-components/transactions-fn.ts for why.

export type BankUploadRow = Awaited<ReturnType<typeof getBankUploads>>[number]

// The documents uploaded for one bank account (e.g. imported statement
// PDFs), newest first, each with the reconciliations (oldest first) done from
// it - none until one is linked.
export const getBankUploads = createServerFn({ method: "GET" })
  .validator((bankAccountId: number) => bankAccountId)
  .handler(async ({ data: bankAccountId }) => {
    await requireUser()
    const rows = await db
      .select({
        id: bankUpload.id,
        description: bankUpload.description,
        uploadedAt: bankUpload.createdAt,
        uploadedBy: user.name,
        reconId: recon.id,
        reconStatementDate: recon.statementDate,
      })
      .from(bankUpload)
      .innerJoin(user, eq(user.id, bankUpload.createdBy))
      .leftJoin(recon, eq(recon.bankUploadId, bankUpload.id))
      .where(eq(bankUpload.bankId, bankAccountId))
      .orderBy(desc(bankUpload.createdAt), desc(bankUpload.id), asc(recon.id))

    // One row per upload: an upload with several reconciliations came back
    // once for each.
    const uploads = new Map<
      number,
      {
        id: number
        description: string
        uploadedAt: Date
        uploadedBy: string
        recons: { id: number; statementDate: string }[]
      }
    >()
    for (const { reconId, reconStatementDate, ...upload } of rows) {
      const entry = uploads.get(upload.id) ?? { ...upload, recons: [] }
      if (reconId !== null && reconStatementDate !== null) {
        entry.recons.push({ id: reconId, statementDate: reconStatementDate })
      }
      uploads.set(upload.id, entry)
    }
    return [...uploads.values()]
  })

// A temporary download link for one upload. The bucket is private, so links
// are only made on request, for signed-in users, and expire after a few minutes.
export const getBankUploadUrl = createServerFn({ method: "POST" })
  .validator((uploadId: number) => uploadId)
  .handler(async ({ data: uploadId }) => {
    await requireUser()
    const [upload] = await db
      .select({ fileKey: bankUpload.fileUrl })
      .from(bankUpload)
      .where(eq(bankUpload.id, uploadId))
    if (!upload) {
      throw new Error("Upload not found.")
    }
    return { url: await getFileUrl(upload.fileKey) }
  })

export const MAX_UPLOAD_DESCRIPTION_LENGTH = 200

// Changes only the description of an upload - the stored file and its hash
// are untouched.
export const updateBankUploadDescription = createServerFn({ method: "POST" })
  .validator((data: { id: number; description: string }) => data)
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()
    const description = data.description.trim()
    if (description === "") {
      throw new Error("The description can't be empty.")
    }
    if (description.length > MAX_UPLOAD_DESCRIPTION_LENGTH) {
      throw new Error(`The description can be at most ${MAX_UPLOAD_DESCRIPTION_LENGTH} characters.`)
    }

    const updated = await db
      .update(bankUpload)
      .set(withUpdate(userId, { description }))
      .where(eq(bankUpload.id, data.id))
      .returning({ id: bankUpload.id })
    if (updated.length === 0) {
      throw new Error("Upload not found.")
    }
  })
