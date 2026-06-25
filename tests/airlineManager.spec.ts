import { test } from '@playwright/test';
import { appendFileSync } from 'fs';
import { GeneralUtils } from '../utils/general.utils';
import { FuelUtils } from '../utils/fuel.utils';
import { CampaignUtils } from '../utils/campaign.utils';
import { FleetUtils } from '../utils/fleet.utils';
import { MaintenanceUtils } from '../utils/maintenance.utils';
import { PricingUtils } from '../utils/pricing.utils';



test('All Operations', async ({ page }) => {
  test.setTimeout(process.env.CI ? 240000 : 120000);

  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const fleetUtils = new FleetUtils(page);
  const maintenanceUtils = new MaintenanceUtils(page);
  const pricingUtils = new PricingUtils(page);

  await generalUtils.login();

  await page.locator('#mapRoutes').getByRole('img').click();
  // Wait for routes page signature element
  await page.waitForSelector('.route, .route-row, #departAll', { timeout: 10000 }).catch(() => {});
  
  await fuelUtils.analyzePlannedDepartures();
  await generalUtils.closePopupIfOpen();

  await page.locator('#mapMaint > img').first().click();
  // Wait for market modal signature
  await page.waitForSelector('.modal-body, #holding', { timeout: 10000 }).catch(() => {});
  await fuelUtils.buyFuel();

  await page.getByRole('button', { name: ' Co2' }).click();
  await page.waitForSelector('#remCapacity', { timeout: 5000 }).catch(() => {});
  await fuelUtils.buyCo2();
  await generalUtils.closePopupIfOpen();

  await page.locator('div:nth-child(5) > #mapMaint > img').click();
  await page.waitForSelector('.modal-title', { timeout: 5000 }).catch(() => {});
  await campaignUtils.createCampaign();
  await generalUtils.closePopupIfOpen();

  await page.locator('div:nth-child(4) > #mapMaint > img').click();
  await page.waitForSelector('.modal-body', { timeout: 5000 }).catch(() => {});
  await maintenanceUtils.checkPlanes();
  await maintenanceUtils.repairPlanes();
  await generalUtils.closePopupIfOpen();

  await page.locator('#mapRoutes').getByRole('img').click();
  await page.waitForSelector('.route, .route-row, #departAll', { timeout: 10000 }).catch(() => {});
  
  const routesPageUrl = page.url();
  const routesPageTitle = await page.title().catch(() => '');
  console.log(`Opened routes page for pricing. URL: ${routesPageUrl || 'unavailable'}. Title: ${routesPageTitle || 'unavailable'}.`);
  
  let pricingStepSummary = '- Pricing update completed successfully.';
  try {
      const routesPageReadyForPricing = await pricingUtils.waitForRoutesPageReady();
      if (routesPageReadyForPricing) {
          await pricingUtils.updateDailyEasyModePrices();
      } else {
          pricingStepSummary = '- Pricing step skipped because routes page was not ready.';
      }
  } catch (error) {
      pricingStepSummary = '- Pricing step failed with a critical error; moving to departures safely.';
      console.error('Pricing module crashed:', error);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Pricing phase\n${pricingStepSummary}\n\n`);
  }

  await generalUtils.closePopupIfOpen();
  await fleetUtils.departPlanes();

  await page.close();
});
