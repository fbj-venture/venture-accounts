-- Every upload so far is a bank statement.
UPDATE "bank_uploads" SET "category" = 'statement' WHERE "category" IS NULL;
