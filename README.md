# Airline-Manager-4-Bot

This repository contains a bot for Airline Manager 4, built with Playwright and scheduled to run on GitHub Actions. The workflow stays on a single GitHub Actions job, uses cached Chromium, and avoids extra jobs, artifacts, or paid services so it remains friendly to the GitHub free tier.

## Features

### Implemented
- **Enterprise-Grade Reliability**: Atomic persistence for all state files and smart "intent-based" waiting for UI elements.
- **Precision Scheduling**: Integrated with `cron-job.org` for exact execution intervals.
- **High-Frequency Fuel Monitor**: Independent 30-minute market checks.
- **Maintenance Retry Flow**: Automatically handles blocks from A-checks or repairs.
- **Easy Mode Pricing Assistant**: Dynamic ticket price adjustments without manual JSON management.
- **Eco-Friendly Campaigns**: Automatic activation of marketing campaigns.

## 🛡️ Pro-Grade Reliability Features

This bot has been hardened to ensure production-grade stability:

1. **Atomic Persistence Layer**: The bot uses a "Write-then-Swap" strategy for state files (like `market-history.json`). If the bot crashes mid-save, your data remains safe and uncorrupted.
2. **Intent-Based Interaction**: Instead of using fixed delays (`sleep`), the bot monitors for specific UI signals. This makes it significantly faster on low-latency networks while maintaining 100% reliability on slow ones.
3. **Element-Detached Protection**: Advanced iteration logic prevents common Playwright crashes during maintenance checks, even if the game UI reshuffles unexpectedly.
4. **Dependency Pinning**: All core packages are pinned to exact versions to prevent breaking updates from upstream libraries.


## Usage Instructions

### 1. Fork this repository

Fork the repository to your own GitHub account.

### 2. Set up secrets

Go to **Settings** > **Secrets and variables** > **Actions** > **Secrets** and create:

- `EMAIL`: your Airline Manager 4 email.
- `PASSWORD`: your Airline Manager 4 password.

### 3. Set up variables

Go to **Settings** > **Secrets and variables** > **Actions** > **Variables** and create these baseline variables:

- `MAX_FUEL_PRICE`: `550`
- `MAX_CO2_PRICE`: `120`
- `MINIMUM_FUEL_COVER_HOURS`: `12`
- `MINIMUM_CO2_COVER_HOURS`: `24`
- `AVERAGE_FUEL_BURN_PER_DEPARTURE`: `250000`
- `AVERAGE_CO2_BURN_PER_DEPARTURE`: `100000`
- `MARKET_HISTORY_FILE`: optional local cache path such as `.cache/market-history.json`
- `GAME_MODE`: `easy`
- `REPAIR_THRESHOLD_PERCENT`: optional wear threshold for bulk repairs, default `30`
- `MAX_PRICE_UPDATES_PER_RUN`: `12`
- `ENABLE_PRICING`: optional toggle for dynamic pricing (`true`/`false`, case-insensitive). Set to `false` to skip pricing safely.
- `EASY_MODE_ECONOMY_MULTIPLIER_PERCENT`: `110`
- `EASY_MODE_BUSINESS_MULTIPLIER_PERCENT`: `108`
- `EASY_MODE_FIRST_MULTIPLIER_PERCENT`: `106`
- `EASY_MODE_CARGO_LARGE_MULTIPLIER_PERCENT`: `110`
- `EASY_MODE_CARGO_HEAVY_MULTIPLIER_PERCENT`: `108`

### 5. Daily Easy mode pricing

You said you do **not** want to maintain route-by-route pricing JSON.

This version now works differently:

- it does **not** require any route list.
- it only tries to update flights that look **not yet departed** on the routes page.
- it applies simple Easy mode multipliers to the visible price inputs it can find every run, right before departures.

Default Easy mode multipliers:
- Economy: `110%`
- Business: `108%`
- First: `106%`

Optional cargo multipliers if you use cargo aircraft:
- `EASY_MODE_CARGO_LARGE_MULTIPLIER_PERCENT`
- `EASY_MODE_CARGO_HEAVY_MULTIPLIER_PERCENT`

### 6. What the pricing assistant does

The pricing assistant now follows a simpler Easy mode flow:
- it looks for price editors on the routes page
- it skips rows that appear to already be departed
- it updates up to `MAX_PRICE_UPDATES_PER_RUN` flights before the bot departs planes

### 7. Enable GitHub Actions

Open the **Actions** tab in your fork and enable workflows.

### 8. Run it manually once first

1. Open **Actions**.
2. Select **Playwright Tests**.
3. Click **Run workflow**.
4. Wait for the job to finish.
5. Open the run and read the **step summary**.

That run should update the ticket prices of not-yet-departed Easy mode flights before the departure step.

### 9. Let the schedule run automatically

The default schedule is aligned to CET and runs at:
- `Main Operations`: 23:00, 01:00, 03:00, 05:00, 07:00, 09:00, 12:00, 15:00, 18:00, 21:00 (UTC)
- `Fuel Monitor`: Every 30 minutes (`*/30 * * * *`).

If you want fewer GitHub minutes or less frequent runs, reduce the cron expressions in `.github/workflows/playwright.yml` or `.github/workflows/fuel-monitor.yml`.

### 10. High-Frequency Fuel Monitor

The bot now includes a separate, lightweight workflow (`fuel-monitor.yml`) that runs every **30 minutes**. 

- **Automatic**: Checks fuel and CO2 every 30 mins and buys if below your thresholds.
- **Manual Trigger**: Go to **Actions** > **Fuel Monitor (30m)** > **Run workflow** to check the market immediately.
- **Efficiency**: This monitor is extremely fast and avoids unnecessary page loads.

## Maintenance behavior

The bot now handles maintenance in two places:
- during the normal maintenance step
- again immediately before departure attempts

That means if a flight becomes blocked because of a due A-Check or because wear is at or above the configured repair threshold, the bot goes back to maintenance, schedules the work, returns to the routes page, and retries departures.

Bulk repairs now default to `30%` wear, configurable with `REPAIR_THRESHOLD_PERCENT`.

The pricing step also runs immediately before departures on every workflow run, so there is no longer a separate UTC pricing-hour gate to configure.

## Fuel / CO2 market intelligence

The fuel purchaser keeps a local JSON history of in-game fuel and CO2 values, estimates upcoming consumption from the visible planned departures on the routes page, and uses simple threshold-based purchases instead of a more aggressive top-up strategy.

This logic is driven only by what the bot observes inside Airline Manager 4. It does not use or react to any real-world fuel or carbon market data.

The logic now:
- snapshots planned departures before opening the fuel market
- estimates hourly fuel and CO2 usage using configurable average burn-per-departure values
- if fuel or CO2 is at or below the configured market-price threshold, it buys to full remaining capacity immediately
- maintains minimum cover in hours
- if fuel or CO2 falls below the configured minimum cover threshold, it buys to full remaining capacity immediately
- if CO2 is already negative while the market is above the configured threshold, it buys a buffered top-up (at least enough to clear the deficit, otherwise about half the remaining capacity) before departures
- if CO2 is already negative while the market is above the configured threshold, it keeps buying until the deficit is cleared
- skips additional purchases whenever the current cover is already healthy

Because GitHub-hosted runners are ephemeral, the price-history cache is most useful on a persistent runner or when your workflow preserves the file between runs.

## Free-tier guidance

This setup is designed to stay inexpensive on GitHub Actions:

- One workflow job only.
- No matrix builds.
- No artifact uploads.
- No paid APIs.
- Chromium only.
- No route-optimizer scan or route JSON maintenance.
- Updates are capped by `MAX_PRICE_UPDATES_PER_RUN`.

## Scheduling Options

Choose one of the two following methods to run your bot automatically.

### Option 1: GitHub Actions (Standard - Easier)
This uses GitHub's built-in scheduler. It is easy to set up but can sometimes be delayed by 10-60 minutes depending on GitHub's server load.

1. Open `.github/workflows/fuel-monitor.yml` and `.github/workflows/playwright.yml` in this repository.
2. Find the lines under `on:` that are commented out (starting with `# schedule:`).
3. Remove the `#` characters to "uncomment" them.
4. Save (Commit) the files. GitHub will now run the bot according to the schedule.

### Option 2: cron-job.org (Reliability Upgrade - Recommended)
This is for people who want the bot to run **precisely** on time. You will use an external service to "ping" GitHub to start the bot.

#### 1. Create a Secure GitHub Token (Fine-grained)
Using a Fine-grained token is more secure because it gives access **only** to this specific repository.

1. Go to your GitHub [Fine-grained tokens settings](https://github.com/settings/personal-access-tokens/new).
2. **Token name**: `CronJob-Trigger-AM4`.
3. **Expiration**: Choose a long period (e.g., 90 days or 1 year).
4. **Repository access**: Select **Only select repositories** and pick `strike007-3000/Airline-Manager-4-Bot`.
5. **Permissions**: 
   - Click **Repository permissions**.
   - Find **Actions** and set access to **Read and write**.
6. Click **Generate token** and **copy it immediately**.

#### 2. Configure cron-job.org Jobs
1. Click the **+ Create Cronjob** button in your cron-job.org dashboard.
2. **Title**: `AM4 Fuel Monitor` (or `AM4 Main Ops`).
3. **URL**: Use the corresponding URL from the table below.
4. **Request Method**: Change it from `GET` to `POST`.
5. **Request Body**: Select **Raw data** and paste: `{"ref":"main"}`
6. **HTTP Headers** (Crucial):
   - Add these three headers under **Advanced** > **HTTP Headers**:
     - `Accept`: `application/vnd.github+json`
     - `Authorization`: `Bearer YOUR_FINE_GRAINED_TOKEN_HERE`
     - `X-GitHub-Api-Version`: `2022-11-28`
7. **Execution Schedule**:
   - For **Fuel**: Every 30 minutes (`0,30 * * * *`).
   - For **Main Ops**: Choose your preferred hours.
8. Click **Create**.

| Job Title | Target Workflow URL |
| :--- | :--- |
| **Fuel Monitor** | `https://api.github.com/repos/strike007-3000/Airline-Manager-4-Bot/actions/workflows/fuel-monitor.yml/dispatches` |
| **Main Ops** | `https://api.github.com/repos/strike007-3000/Airline-Manager-4-Bot/actions/workflows/playwright.yml/dispatches` |

---

## Step-by-step: how to start running this on GitHub Actions

1. Fork the repository.
2. Add the `EMAIL` and `PASSWORD` secrets.
3. Add `MAX_FUEL_PRICE` and `MAX_CO2_PRICE`.
4. Add `GAME_MODE=easy`.
5. Add `MAX_PRICE_UPDATES_PER_RUN=12`.
6. Add `ENABLE_PRICING=false` for tonight’s production runs (set back to `true` when you want pricing updates again).
7. Add `EASY_MODE_ECONOMY_MULTIPLIER_PERCENT=110`.
8. Add `EASY_MODE_BUSINESS_MULTIPLIER_PERCENT=108`.
9. Add `EASY_MODE_FIRST_MULTIPLIER_PERCENT=106`.
10. Enable GitHub Actions.
11. Run the workflow manually once.
12. If everything looks good, leave the schedule enabled.

## Notes
- Language of your game must be **English** for this bot to work.
- Trigger times may vary due to heavy loads on GitHub Actions.
- To change the schedule, edit the **cron** expressions under **schedule** in `.github/workflows/playwright.yml`. Use [crontab.guru](https://crontab.guru/) to generate your desired cron expression.
- GitHub Actions cron itself is UTC, so the default workflow already uses the UTC equivalents for the listed CET run times.
- This repository can be public as long as your login details stay in GitHub **Actions secrets** and your thresholds stay in GitHub **Actions variables**. Do not commit credentials or personal values directly into the repository.
- If you still prefer not to expose the code publicly, you can clone this project and commit it to a private repository instead.
- For questions, reach out on Discord: `muhittin852`.
