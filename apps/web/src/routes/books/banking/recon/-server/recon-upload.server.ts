import { requireUser } from "#/lib/require-user.server.ts"
import { bankAccount, bankUpload, db, recon, withCreate, withUpdate } from "@app/db/direct"
import { deleteFile, isStorageConfigured, uploadFile } from "@app/storage"
import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { createHash } from "node:crypto"

// Keep ALL database code inside handlers - see the route folder layout in
// CLAUDE.md for why.

const MAX_PDF_BYTES = 25 * 1024 * 1024

// Uploads a statement PDF and links it to a reconciliation that has none yet.
// Only the file is stored - nothing is read from it and no transactions are
// imported (that is what the Import pages are for). The upload's statement
// date is the reconciliation's own statement ending date.
//
// The form carries: file (the PDF), reconId, and an optional description.
// The file is stored under a key of its own, so it never replaces another
// stored statement. Returns the new upload.
export const uploadReconStatement = createServerFn({ method: "POST" })
  .validator((data: FormData) => {
    if (!(data instanceof FormData)) {
      throw new Error("Expected a form.")
    }
    return data
  })
  .handler(async ({ data }) => {
    const { id: userId } = await requireUser()

    const file = data.get("file")
    const reconId = Number(data.get("reconId"))
    const rawDescription = data.get("description")
    if (!(file instanceof File)) {
      throw new Error("Choose a PDF to upload.")
    }
    if (!Number.isInteger(reconId)) {
      throw new Error("Reconciliation not found.")
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF documents are supported.")
    }
    if (file.size === 0 || file.size > MAX_PDF_BYTES) {
      throw new Error("The PDF must be between 1 byte and 25 MB.")
    }
    if (!isStorageConfigured()) {
      throw new Error("File storage isn't set up on this server.")
    }

    const [row] = await db
      .select({
        bankAccountId: recon.bankAccountId,
        statementDate: recon.statementDate,
        bankUploadId: recon.bankUploadId,
        accountNumber: bankAccount.accountNumber,
      })
      .from(recon)
      .innerJoin(bankAccount, eq(bankAccount.id, recon.bankAccountId))
      .where(eq(recon.id, reconId))
    if (!row) {
      throw new Error("Reconciliation not found.")
    }
    if (row.bankUploadId !== null) {
      throw new Error("This reconciliation already has a statement linked.")
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const fileHash = createHash("sha256").update(bytes).digest("hex")

    // The same file can only be recorded once per bank account.
    const [duplicate] = await db
      .select({ id: bankUpload.id, description: bankUpload.description })
      .from(bankUpload)
      .where(and(eq(bankUpload.bankId, row.bankAccountId), eq(bankUpload.fileHash, fileHash)))
    if (duplicate) {
      throw new Error(
        `This file has already been uploaded for this bank account ("${duplicate.description}"). Use Link to choose it instead.`,
      )
    }

    const description =
      (typeof rawDescription === "string" ? rawDescription.trim() : "") ||
      `Statement ending ${row.statementDate} (${file.name})`
    const folder = row.accountNumber.replace(/[^0-9A-Za-z-]/g, "")
    const key = `statements/${folder}/linked/${row.statementDate}-${fileHash.slice(0, 8)}.pdf`

    await uploadFile(key, bytes, "application/pdf")
    try {
      const upload = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(bankUpload)
          .values(
            withCreate(userId, {
              bankId: row.bankAccountId,
              description,
              fileUrl: key,
              fileHash,
              category: "statement",
              statementDate: row.statementDate,
            }),
          )
          .returning({ id: bankUpload.id })
        await tx
          .update(recon)
          .set(withUpdate(userId, { bankUploadId: created!.id }))
          .where(eq(recon.id, reconId))
        return { id: created!.id, description }
      })
      return upload
    } catch (error) {
      // Nothing was recorded, so don't leave the file behind.
      await deleteFile(key).catch(() => {})
      throw error
    }
  })
