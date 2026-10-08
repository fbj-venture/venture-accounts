# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
