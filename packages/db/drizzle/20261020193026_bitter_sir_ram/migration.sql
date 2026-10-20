-- Custom SQL migration file, put your code below! --
UPDATE bank_account
SET
    bank_id = (
        SELECT
            id
        FROM
            bank
        WHERE
            name = 'FNB'
    )
WHERE
    bank_name = 'FNB';

UPDATE bank_account
SET
    bank_id = (
        SELECT
            id
        FROM
            bank
        WHERE
            name = 'Standard Bank'
    )
WHERE
    bank_name = 'Standard Bank';
