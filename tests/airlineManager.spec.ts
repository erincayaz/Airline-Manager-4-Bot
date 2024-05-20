import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/general.utils';
import { FuelUtils } from '../utils/fuel.utils';
import { CampaignUtils } from '../utils/campaign.utils';
import { FleetUtils } from '../utils/fleet.utils';

require('dotenv').config();

test('All Operations', async ({ page }) => {
  // Variable Initialization
  const fuelUtils = new FuelUtils(page);
  const generalUtils = new GeneralUtils(page);
  const campaignUtils = new CampaignUtils(page);
  const fleetUtils = new FleetUtils(page);
  // End //

  // Login //
  await generalUtils.login(page);

  // Fuel Operations //
  await page.locator('#mapMaint > img').first().click();
  await fuelUtils.buyFuel();

  await page.getByRole('button', { name: ' Co2' }).click();
  await fuelUtils.buyCo2();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  // End //

  // Campaign Operations //
  await page.locator('div:nth-child(5) > #mapMaint > img').click();
  await campaignUtils.createCampaign();

  await page.locator('#popup > .modal-dialog > .modal-content > .modal-header > div > .glyphicons').click();
  // End //

  // Depart Planes Operations //
  await page.locator('#mapRoutes').getByRole('img').click();
  await GeneralUtils.sleep(2500);

  await fleetUtils.departPlanes();
  // End //

  page.close();
});
