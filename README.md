# Airline-Manager-4-Bot

This repository contains a bot for Airline Manager 4, built with Playwright and scheduled to run on GitHub Actions. The bot is designed to run every hour at 01 and 31 minutes but the schedule can be changed according to preference.
## Features

### Implemented
- Start an eco-friendly campaign if not already started.
- Buy fuel and CO2 if prices are below specified thresholds.
- Depart all planes.
- Schedule repairs and A-Checks if needed.
- Buy fuel and CO2 at higher prices if supplies are nearly finished.

## Usage Instructions

1. **Fork this repository.**
2. **Set up secrets:**
   - Go to **Settings** > **Actions** > **Secrets and variables**.
   - Create the following repository secrets:
     - `EMAIL`: \<YOUR-EMAIL>
     - `PASSWORD`: \<YOUR-PASSWORD>
3. **Set up variables:**
   - Go to **Settings** > **Actions** > **Variables**.
   - Create the following variables:
     - `MAX_FUEL_PRICE`: 550 (Set your desired price. The bot will buy fuel if the current price is lower.)
     - `MAX_CO2_PRICE`: 120 (Same as fuel.)
4. **Enable workflows:**
   - Go to **Actions** and enable workflows.
5. The workflow will now be triggered twice every hour at 01 and 31 minutes.

## Notes
- Trigger times may vary due to heavy loads on GitHub Actions.
- To change the schedule, edit the **cron** expression under **schedule** in `.github/workflows/playwright.yml`. Use [crontab.guru](https://crontab.guru/) to generate your desired cron expression.
- If you don't want your repo to be public you can clone this project and commit it to your private repo. 
- For questions, reach out on Discord: `muhittin852`.