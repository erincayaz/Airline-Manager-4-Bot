import { test } from '@playwright/test';
import { GeneralUtils } from '../utils/general.utils';
import { FuelUtils } from '../utils/fuel.utils';



test('Fuel and CO2 Monitor', async ({ page }) => {
  // Set a shorter timeout for the monitor run
  test.setTimeout(process.env.CI ? 60000 : 30000);

  const generalUtils = new GeneralUtils(page);
  const fuelUtils = new FuelUtils(page);

  // 1. Login
  await generalUtils.login();

  // 2. Quick analysis of departures to inform buying logic (Cover Hours)
  await page.locator('#mapRoutes').getByRole('img').click();
  await page.waitForSelector('.route, .route-row, #departAll', { timeout: 10000 }).catch(() => {});
  await fuelUtils.analyzePlannedDepartures();
  await generalUtils.closePopupIfOpen();

  // 3. Navigate to Fuel/Maintenance and Buy Fuel
  await page.locator('#mapMaint > img').first().click();
  await page.waitForSelector('.modal-body, #holding', { timeout: 10000 }).catch(() => {});
  await fuelUtils.buyFuel();

  // 4. Buy CO2
  await page.getByRole('button', { name: /Co2/i }).click();
  await GeneralUtils.sleep(2000); // 2s delay to ensure market numbers (Price/Holding) have updated to CO2 scale
  await page.waitForSelector('#remCapacity:visible', { timeout: 5000 }).catch(() => {});
  await fuelUtils.buyCo2();

  await page.close();
});
