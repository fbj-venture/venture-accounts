# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.15.0] - 2026-10-19

### Added

- Added a Company Settings page, populated from the database, with:
  - Financial year end
  - Company Name
  - Starting year
- Reports
  - Trial ballance
  - General ledger
  - Export to Excel for both of them

## [0.14.0] - 2026-10-19

### Added

- Added customizable Docker container and compose for running totally locally

## [0.12.2] - 2026-10-18

### Changed

- Remove Neon specific dependencies, `pg` only now.

### Added

- A `dockerfile` for local, independent usage

## [0.12.1] - 2026-10-17

### Changed

- Added caching to all the loaders

## [0.12.0] - 2026-10-

### Added

- Add a new PDF importer for Standard Bank History Transactions items (based on the Hash v2 algorithm)

## [0.11.0] - 2026-10-16

### Changed

- The Hashing algorithm for the imports
- Fixed all the data

## [0.10.2] - 2026-10-15

### Added

- An Add Bank Account button on the manage Bank Accounts screen
- Added an Archive checkbox filter to the Accounts page

### Changed

- Updated various controls to make them more user friendly
- Default for Accounts and Bank Accounts view is unarchived only

## [0.10.1] - 2026-10-15

### Changed

- Removed `t3.env` and fixed references

## [0.10.0] - 2026-10-15

### Added

- Integrations
  - Move from `t3.env` to `varlock` (<https://varlock.dev/>)
  - Integrate PostHog (<https://posthog.com/>)

## [0.9.1] - 2026-10-15

### Changed

- Added an `|` (OR) operator for the amount range filter box

## [0.9.0] - 2026-10-14

### Changed

- Upgrade to Tanstack Start V1 & Nitro v3 with latest dependencies
- Fixed the database URL warnings

## [0.8.0] - 2026-10-13

### Added

- Add audit fields to Account creation and changes
- Bank account Management
  - List bank accounts
  - Add an is_archived & audit columns
  - Edit Bank Account details

### Changed

- Lists section: Accounts & Bank Accounts
  - Updated the nav components bar and add a type for adding new links
- Accounts
  - Additional text filter
  - Add an add dialog with a parent drop-down list
- Import
  - Add an index page where you select the kind of import you want to make
  - Update the current loader to be titled: Standard Bank Statement Uploader

## [0.7.0] - 2026-10-12

### Added

- Accounts
  - Add an is_archived flag to the Account
  - Set it on the Accounts page
  - Filter the accounts list to non-archived Accounts
- Restructure files and folders for separation of concerns and update the `claude.md` memory
  - Move server functions into their own server folders and rename to *.server.ts
- Add Tanstack Query and make sub-pages client-side

## [0.6.0] - 2026-10-12

### Added

- Settings
  - Create Schema
  - Auto-create for user on login
  - Starting year for drop-downs (defaults to 2024)
  - Create a page on the users menu that sets it
  - Move the Theme selector into the Settings page
- Add a note textbox before the amount in the post-transactions table
- Admin
  - Create Accounts section
  - List all accounts
  - Rename Accounts & Bank Accounts

### Fixed

- Fix collapsed main navigation
- Transfers
  - Lookup transactions and display matches
  - Pre-select if there's only one line
  - Display if there's multiple lines and require a selection

## [0.5.5] - 2026-10-08

### Changed

- Starting years for drop-down is 2020
- More sortable tables
- Preselect all the items for recon
  - Also make sure that the amounts are formatted
- Make sure that the new recon screen refreshes properly
- Make checkboxes in light mode more visible

## [0.5.4] - 2026-10-08

### Changed

- The User menu icon from an up-down to a right chevron

### Added

- An admin-only popup to indicate the current version and build time of the app

## [0.5.3] - 2026-10-08

### Added

- Filter by description to Find Transactions
- Admin-only ability to un-post a transaction

## [0.5.2] - 2026-10-08

### Added

- Added sorting to the Find Transactions table

## [0.5.1] - 2026-10-07

### Added

- HTML emails with react.email
  - Password reset
  - Verify email

## [0.5.0] - 2026-10-07

### Added

- Login
  - Reset password request
- System users
  - Send new user verification email
  - Email verification links from table and personal details
  - Made email in user details an email link
- Personal preferences
  - Change my password: send email verification first if not verified, then password change email with link

### Changed

- New users get a joining email to set their password
- Personal Settings menu was changed to Change Password

## [0.4.1] - 2026-10-07

### Added

- A search transactions page
  - Multiple (optional) criteria and a search button
  - Preselected bank_account when launched from a dashboard item
  - Remember last criteria but don't auto-execute

## [0.4.0] - 2026-10-07

### Added

- accounts drop-down
  - Change display for sub-items to be indented with a "branch" character
- Audit trails
  - Bank recon
  - Journal entry createdBy, ReconciledBy user
  - Journal Line CreatedBy, assignedBy, ReconciledBy user
- Bank statements
  - List recons per Bank account (new tab on Recon.$id.tsx - lazy-loaded)
  - View Recon details
  - Add upload details to recon
- Railway Uploads
  - Upload PDF
  - List uploads from Dashboard
  - Download PDF
- Personal preferences
  - Edit personal details & add avatar

## [0.3.0] - 2026-10-05

### Added

- Bank statement reconciliations
  - Opening ballance
  - Start and end date
  - Display transactions to check and a running ballance
- System users
  - Deactivate user (Ban)
  - Change user role
  - Delete user
  - Add new user

### Changed

- **NB** Email is blocked by the namespace servers on domains.co.za
  - Therefore no password-reset or other emails from the system

## [0.2.0] - 2026-10-02

### Changed

- Updated the algorithm for finding and auto-allocating transfers to include the weekday before and after.

### Added

- Add T3.env to the project and configure it
  - Update all the direct references to `process.env`
- Debounce the login to prevent DoS
- `favicon` generation
- View Bank Account balances
- Move to using Shadcn Table
- System users
  - List users
  - Setup application roles

## [0.1.0] - 2026-09-28

### Added

- Take-on amount (Equity)
- Transfers to bank account
- Find matching account journal-line
- Work-out how to link the two
- that transfers have no other Account
- Ensure that transfer is displayed when not posted
- Ensure the recon will work with transfers reflected from both sides.
- Upgrade Drizzle to v1
- Deploy to Railway
