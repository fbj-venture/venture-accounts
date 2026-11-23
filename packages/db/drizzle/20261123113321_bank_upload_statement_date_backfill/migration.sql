-- The importer names every stored file by its statement date: "<yyyy-MM-dd>.pdf",
-- or "ad-hoc/<yyyy-MM-dd>-<hash>.pdf" for a Transaction History PDF (the last
-- day it covers). The first date in the key is therefore the statement date.
UPDATE "bank_uploads"
SET "statement_date" = to_date(substring("file_url" from '[0-9]{4}-[0-9]{2}-[0-9]{2}'), 'YYYY-MM-DD')
WHERE "statement_date" IS NULL;
