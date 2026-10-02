# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-02

### Changed

* Updated the algorithm for finding and auto-allocating transfers to include the weekday before and after.

### Added

* Add T3.env to the project and configure it
  * Update all the direct references to `process.env`
* Debounce the login to prevent DoS
* `favicon` generation
* View Bank Account balances
* Move to using Shadcn Table
* System users
  * List users
  * Setup application roles

## [0.1.0] - 2026-09-28

### Added

* Take-on amount (Equity)
* Transfers to bank account
* Find matching account journal-line
* Work-out how to link the two
* that transfers have no other Account
* Ensure that transfer is displayed when not posted
* Ensure the recon will work with transfers reflected from both sides.
* Upgrade Drizzle to v1
* Deploy to Railway
