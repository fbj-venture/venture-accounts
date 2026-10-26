// The ways of importing bank transactions. Add an entry here (and its page
// under routes/books/banking/import) for each new importer. No server-only
// imports, so the import page and the Company Settings page can both use it.
//
// key is stored in company_settings.hidden_importers, so never rename it.
// bankName is the bank table entry whose logo marks the importer.
export const IMPORTERS = [
  {
    key: "sb-statement",
    title: "Standard Bank Statement (PDF)",
    bankName: "Standard Bank",
    description:
      "Upload a Standard Bank statement in PDF format. The bank account and statement date are read from the statement.",
    to: "/books/banking/import/sb-statement",
  },
  {
    key: "sb-history",
    title: "Standard Bank Transaction History (PDF)",
    bankName: "Standard Bank",
    description:
      "Upload a Transaction History Statement downloaded from the bank's website, to import transactions before the monthly statement is issued.",
    to: "/books/banking/import/sb-history",
  },
  {
    key: "fnb-unverified",
    title: "FNB Unverified Statement (PDF)",
    bankName: "FNB",
    description:
      "Upload an FNB statement (unverified) that you have downloaded from the FNB website to import transactions. The statement date and bank account are read from the statement.",
    to: "/books/banking/import/fnb-unverified",
  },
] as const

export const IMPORTER_KEYS: readonly string[] = IMPORTERS.map((importer) => importer.key)
