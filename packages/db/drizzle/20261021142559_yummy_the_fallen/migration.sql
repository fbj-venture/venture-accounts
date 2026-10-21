-- Custom SQL migration file, put your code below! --
-- The canonical account types (see src/schema/account-type.ts). account_type.id
-- isn't auto-generated, so these fixed IDs are the reference for every account type.
INSERT INTO
    account_type (id, name, description, normal_balance)
VALUES
    (
        1,
        'Asset',
        'What you own or are owed (Bank, Cash, Equipment, Accounts Receivable)',
        'debit'
    ),
    (
        2,
        'Liability',
        'What you owe (Credit Card, Loans, Accounts Payable)',
        'credit'
    ),
    (
        3,
        'Equity',
        'Net worth / ownership residual (Opening Balance, Retained Earnings)',
        'credit'
    ),
    (
        4,
        'Income',
        'Money earned in a period (Salary, Sales Revenue)',
        'credit'
    ),
    (
        5,
        'Expense',
        'Money spent in a period (Rent, Groceries, Utilities)',
        'debit'
    ) ON CONFLICT (id) DO NOTHING;
