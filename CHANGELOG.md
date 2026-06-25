# Changelog

All notable changes to the Airline Manager 4 Bot will be documented in this file.

## [1.2.5] - 2026-06-25
### Deleted
- **Centralized dotenv**: Removed 6 redundant `require('dotenv').config()` calls across utils and test files. Environment loading now happens once in `playwright.config.ts`.
- **Redundant `page` parameter**: `GeneralUtils.login()` no longer takes a `page` argument — it uses the instance's `this.page` like every other method.
- **Dead code**: Removed unused `isVisibleSafe()` method from `MaintenanceUtils`.
- **Duplicate modal logic**: Removed `closeMaintenanceModal()` from `MaintenanceUtils` — callers now use the existing `GeneralUtils.closePopupIfOpen()`.
- **Unused variable**: Removed `routesContainer` from `PricingUtils.updateDailyEasyModePrices()`.

### Fixed
- **Typo**: Corrected `kemudian` → `then` in `GeneralUtils.atomicWriteFileSync` docstring.
- **Inconsistent indentation**: Fixed mixed 2/4-space indentation inside `PricingUtils` try/finally block.

## [1.2.4] - 2026-06-25
### Fixed
- **Stable Navigation**: Configured `page.goto` to use `domcontentloaded` wait state with a 30s timeout, avoiding hangs on slow external scripts.
- **Robust Modal Close**: Improved `closePopupIfOpen` to wait up to 500ms for transitioning modals to show, before sending native Escape keyboard events to guarantee closing Bootstrap modals.

## [1.2.3] - 2026-04-16
### Fixed
- **CO2 Negative Fix**: Resolved a race condition where the bot would read Fuel market data instead of CO2 data due to shared element IDs.
- **Robust Market Detection**: Added `:visible` filters to market locators to ensure data is read from the active UI tab.
- **Improved Debt Recovery**: Fixed a logic bug in the purchase calculator that prevented buying CO2 when the account was in debt but the UI reported zero remaining capacity.

## [1.2.2] - 2026-04-15
### Added
- **Armor-Plated Navigation**: Implemented a 4-tier escape plan for route details, including a "Nuclear Reset" fallback to prevent the bot from getting stuck in modals.
- **Revenue Protection**: Wrapped the pricing module in a global safety bubble; if pricing fails, the bot will now automatically skip to departures instead of failing the run.
- **Per-Flight Error Isolation**: Failures during pricing are now isolated to a single plane, allowing the bot to continue with the rest of the fleet.

## [1.2.1] - 2026-04-15
### Added
- **Label-Based Pricing Safety**: The bot now reads seat class labels (Economy, Business, etc.) before setting prices to ensure 100% accuracy even if the game UI shifts.
- **Zero-Idle Campaigns**: Replaced remaining sleeps in marketing logic with dynamic wait signals.

### Fixed
- **IDE Problems Resolved**: Updated `tsconfig.json` with DOM and ESNext libraries to clear persistent "4 Problems" in VS Code.

## [1.2.0] - 2026-04-15
### Added
- **Atomic Persistence**: Implemented `atomicWriteFileSync` in `GeneralUtils` to prevent file corruption during crashes.
- **Smart UI Interaction**: Replaced hard coded `sleep` delays with dynamic `waitForSelector` and `waitForLoadState` signals across all utilities.
- **Hardened Maintenance Logic**: Added "all snapshots" to bulk check iteration to prevent "Element Detached" errors.
- **Dependency Pinning**: Pinned all NPM dependencies to exact versions for build reproducibility.

### Changed
- Refined `playwright.yml` and `fuel-monitor.yml` indentation to clear IDE linting warnings.
- Improved `FleetUtils.departPlanes` loop with better resource-blocked detection.

### Fixed
- Fixed a duplicate `return` statement in `FleetUtils.getDepartureModalText`.
- Removed several unused environment variables from `playwright.yml`.

## [1.1.0] - 2026-04-14
### Added
- **cron-job.org Support**: Added comprehensive support and documentation for external the precise scheduling.
- **Dual Tracking Mode**: README updated with both GitHub Actions and cron-job.org instructions.

## [1.0.0] - 2026-04-06
### Added
- Initial release with core features: Fuel monitor, Automatic maintenance, and Easy mode pricing.
