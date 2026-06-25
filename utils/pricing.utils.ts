import { Locator, Page } from '@playwright/test';
import { appendFileSync } from 'fs';
import { ConfigUtils } from './config.utils';

export class PricingUtils {
  private readonly page: Page;
  private readonly githubStepSummary?: string;
  private readonly maxPriceUpdatesPerRun: number;
  private readonly pricingDeadlineMs: number;
  private readonly gameMode: string;
  private readonly enablePricing: boolean;
  private readonly multipliers: { [key: string]: number };

  constructor(page: Page) {
    this.page = page;
    this.githubStepSummary = process.env.GITHUB_STEP_SUMMARY;
    // Set to 12 updates per run natively
    this.maxPriceUpdatesPerRun = ConfigUtils.optionalNumber('MAX_PRICE_UPDATES_PER_RUN', 12);
    // 60 seconds pricing deadline so it never bleeds into the 120s test timeout
    this.pricingDeadlineMs = ConfigUtils.optionalNumber('PRICING_DEADLINE_MS', 60000);
    this.gameMode = ConfigUtils.optionalString('GAME_MODE', 'easy').toLowerCase();
    this.enablePricing = ConfigUtils.optionalBoolean('ENABLE_PRICING', false);
    
    this.multipliers = {
      economy: ConfigUtils.optionalNumber('EASY_MODE_ECONOMY_MULTIPLIER_PERCENT', 110) / 100,
      business: ConfigUtils.optionalNumber('EASY_MODE_BUSINESS_MULTIPLIER_PERCENT', 108) / 100,
      first: ConfigUtils.optionalNumber('EASY_MODE_FIRST_MULTIPLIER_PERCENT', 106) / 100,
      cargoLarge: ConfigUtils.optionalNumber('EASY_MODE_CARGO_LARGE_MULTIPLIER_PERCENT', 110) / 100,
      cargoHeavy: ConfigUtils.optionalNumber('EASY_MODE_CARGO_HEAVY_MULTIPLIER_PERCENT', 108) / 100,
    };
  }

  public async waitForRoutesPageReady(timeoutMs = 10000): Promise<boolean> {
    try {
      console.log('Waiting for routes page to be ready...');
      await this.page.getByText(/Cost index/i).first().waitFor({ state: 'visible', timeout: timeoutMs });
      return true;
    } catch {
      console.log(`Routes page readiness timed out after ${timeoutMs}ms.`);
      return false;
    }
  }

  public async updateDailyEasyModePrices(): Promise<void> {
    if (!this.enablePricing) {
      console.log('Pricing disabled by ENABLE_PRICING=false; skipping.');
      return;
    }

    if (this.gameMode !== 'easy') {
      console.log(`Dynamic pricing skipped because GAME_MODE is set to ${this.gameMode}.`);
      return;
    }

    console.log('Pre-departure Easy mode ticket-price check started...');
    const runDeadline = Date.now() + this.pricingDeadlineMs;


    const routeLinks = this.page.locator('a:visible, button:visible, [role="link"]:visible').filter({
      hasText: /.+ - .+/i
    });

    const count = await routeLinks.count().catch(() => 0);
    console.log(`[Pricing] Found ${count} potential route links inside the active container.`);

    let updatedFlights = 0;
    let inspectedFlights = 0;

    for (let index = 0; index < count; index++) {
      if (updatedFlights >= this.maxPriceUpdatesPerRun) {
        console.log(`Reached max price updates per run: ${this.maxPriceUpdatesPerRun}`);
        break;
      }
      if (Date.now() > runDeadline) {
        console.log(`Pricing deadline reached (${this.pricingDeadlineMs}ms); stopping further updates to save GitHub Action time.`);
        break;
      }

      await this.waitForRoutesPageReady(5000).catch(() => false);

      const link = routeLinks.nth(index);
      if (!(await link.isVisible().catch(() => false))) {
        continue;
      }

      const linkText = await link.innerText().catch(() => '');
      if (/^(next|prev|previous)$/i.test(linkText) || /^\d+$/.test(linkText)) {
        continue;
      }

      const rowText = await link.evaluate((el: HTMLElement) => {
        let curr: HTMLElement | null = el.parentElement;
        for (let i = 0; i < 6 && curr; i++) {
          if (curr.innerText && (curr.innerText.match(/depart|demand/i) || curr.innerText.match(/#/))) {
            return curr.innerText.toLowerCase();
          }
          curr = curr.parentElement;
        }
        return '';
      }).catch(() => '');

      let flightCode = '';
      const match = rowText.match(/#([A-Z0-9-]+)/i);
      if (match) {
        flightCode = match[1];
      }

      if (rowText.includes('departed') || rowText.includes('airborne') || rowText.includes('arrived')) {
        continue;
      }

      inspectedFlights++;
      console.log(`\n--- [Pricing] Inspecting Route [${inspectedFlights}]: ${linkText} [Code: ${flightCode || 'Unknown'}] ---`);

      try {
        console.log(`[${flightCode}] Clicking route link...`);
        await link.click({ timeout: 5000 });
        
        // Wait for ANY signal that the detail view is open
        await Promise.any([
          this.page.getByText(/seat layout|cargo|capacity|load|config/i).first().waitFor({ state: 'visible', timeout: 10000 }),
          this.page.locator('button, .btn').filter({ hasText: /^auto([^a-z]|$)/i }).first().waitFor({ state: 'visible', timeout: 10000 }),
          this.page.locator('.modal-header, .box-header').waitFor({ state: 'visible', timeout: 10000 })
        ]).catch(() => {
           throw new Error('Route detail modal failed to open or was too slow.');
        });

      } catch (e) {
        console.warn(`[${flightCode}] Failed to enter route details: ${(e as Error).message}`);
        await this.returnToRoutesList(flightCode);
        continue;
      }

      // We use a dedicated try/finally for the modal logic to ensure we ALWAYS attempt to close it
      try {
        const seatLayoutHeader = this.page.getByText(/seat layout|cargo|capacity|load|config/i).first();
        const autoButton = this.page.locator('button, .btn, [role="button"]').filter({ hasText: /^auto([^a-z]|$)/i }).first();

        // Expand seat layout if necessary
        if (await seatLayoutHeader.isVisible().catch(() => false) && !(await autoButton.isVisible().catch(() => false))) {
          console.log('Seat Layout header is visible but Auto is not. Clicking header to expand...');
          await seatLayoutHeader.click({ timeout: 3000, force: true }).catch(() => {});
          await this.page.waitForTimeout(500);
        }

        if (!(await autoButton.isVisible().catch(() => false))) {
          console.log('Auto button not found even after expansion attempt.');
          await this.returnToRoutesList(flightCode);
          continue;
        }

        console.log('Clicking Auto button...');
        await autoButton.click({ timeout: 3000, force: true }).catch((e) => console.log('Auto click error: ' + e.message));
        await this.page.waitForTimeout(1000);

        let changedAnyPrice = false;

        // Find ALL visible inputs in the modal
        const visibleInputs = this.page.locator('.modal:visible input:visible');
        const inputCount = await visibleInputs.count().catch(() => 0);
        console.log(`Found ${inputCount} visible inputs in the Seat Layout modal.`);

        // Since AM4 uses type="number" or untyped HTML inputs for prices, we grab all visible inputs.
        // We also check for nearby text to identify the class (Economy, Business, First, Cargo)
        let classInputs: { locator: Locator, label: string }[] = [];
        for (let j = 0; j < inputCount; j++) {
          const inputLocator = visibleInputs.nth(j);
        
          // Use evaluate to find the nearest descriptive label for this input
          const detectedLabel = await inputLocator.evaluate((el) => {
            const row = el.closest('tr, .row, .input-group') as HTMLElement | null;
            const text = row?.innerText?.toLowerCase() || '';
            if (text.includes('eco')) return 'economy';
            if (text.includes('bus')) return 'business';
            if (text.includes('fir')) return 'first';
            if (text.includes('large')) return 'cargoLarge';
            if (text.includes('heavy') || text.includes('tra')) return 'cargoHeavy';
            return '';
          }).catch(() => '');

          if (detectedLabel) {
            classInputs.push({ locator: inputLocator, label: detectedLabel });
          }
        }

        console.log(`Detected ${classInputs.length} labelled price inputs.`);

        for (const item of classInputs) {
          const multiplier = this.multipliers[item.label];
          if (multiplier) {
            const changed = await this.updateAmount(item.locator, multiplier, item.label, item.label.startsWith('cargo'));
            if (changed) changedAnyPrice = true;
          }
        }

        if (changedAnyPrice) {
          console.log('Prices were changed. Looking for Save button...');
          const saveButton = this.page.getByRole('button', { name: /^save$/i }).first();
          if (await saveButton.isVisible().catch(() => false)) {
            console.log('Clicking Save button...');
            await saveButton.click({ timeout: 3000, force: true }).catch((e) => console.log('Save click error: ' + e.message));
            await this.page.waitForTimeout(500);
            updatedFlights++;
            console.log(`Route updated successfully: ${linkText}`);
          } else {
            console.log('Save button was not visible!');
          }
        } else {
          console.log('No prices needed updating (already optimal).');
        }

      } catch (error) {
          console.error(`[${flightCode}] Critical error during price update: ${(error as Error).message}`);
      } finally {
          console.log(`[${flightCode}] Finalizing modal state...`);
          await this.returnToRoutesList(flightCode);
      }
    }

    const summary = updatedFlights > 0
      ? `## Dynamic ticket pricing\n- Updated prices for ${updatedFlights} flights.`
      : `## Dynamic ticket pricing\n- No flights needed updating. Inspected ${inspectedFlights} route pages.`;
    this.appendSummary(summary);
    console.log(`Pre-departure ticket-price check finished. Updated flights: ${updatedFlights}.`);
  }

  private async updateAmount(input: Locator, multiplier: number, label: string, isCargo: boolean = false): Promise<boolean> {
    try {
      const currentValueStr = await input.inputValue({ timeout: 2000 });
      const numericString = currentValueStr.replace(/,/g, '').trim();
      const currentValue = isCargo ? parseFloat(numericString) : parseInt(numericString, 10);
      
      if (currentValue > 0) {
        let nextValue: number;
        if (isCargo) {
          nextValue = parseFloat((currentValue * multiplier).toFixed(2));
        } else {
          nextValue = Math.max(1, Math.floor((currentValue * multiplier) / 10) * 10);
        }

        if (nextValue !== currentValue) {
          console.log(`Updating ${label} from ${currentValue} to ${nextValue}...`);
          await input.click({ timeout: 2000, force: true });
          await input.press('Control+a', { timeout: 2000 });
          await input.fill(nextValue.toString(), { timeout: 2000 });
          return true;
        } else {
          console.log(`Seat ${label} already optimal at ${currentValue}.`);
        }
      }
    } catch (e) {
      console.log(`Failed to update ${label} input: ${(e as Error).message}`);
    }
    return false;
  }

  private async returnToRoutesList(flightCode: string): Promise<void> {
    const logPrefix = `[${flightCode || 'Nav'}]`;
    console.log(`${logPrefix} Closing details...`);

    // Strategy 1: The standard close 'X' button (most reliable for modals)
    const closeBtn = this.page.locator('.modal-header .close, .box-header .close, button.close').first();
    if (await closeBtn.isVisible().catch(() => false)) {
        console.log(`${logPrefix} Clicking 'X' close button.`);
        await closeBtn.click().catch(() => {});
        await this.page.waitForTimeout(500);
        return;
    }

    // Strategy 2: Predefined 'Back' buttons (chevrons)
    const backBtn = this.page.locator('.modal-header, .box-header').locator('span, i, div, a, button').filter({ hasText: /^</ }).first();
    if (await backBtn.isVisible().catch(() => false)) {
      console.log(`${logPrefix} Clicking back chevron.`);
      await backBtn.click().catch(() => {});
      await this.page.waitForTimeout(500);
      return;
    }

    // Strategy 3: Text-based back buttons
    const textBackBtn = this.page.getByText(/<\s*[A-Z0-9-]{3,}/i).first();
    if (await textBackBtn.isVisible().catch(() => false)) {
      console.log(`${logPrefix} Clicking text back.`);
      await textBackBtn.click().catch(() => {});
      await this.page.waitForTimeout(500);
      return;
    }

    // Strategy 4: Nuclear Reset (If all else fails, reload the dashboard container)
    console.warn(`${logPrefix} NO CLOSE BUTTON FOUND. Triggering Nuclear Reset.`);
    const mapRoutes = this.page.locator('#mapRoutes').getByRole('img').first();
    if (await mapRoutes.isVisible().catch(() => false)) {
        await mapRoutes.click().catch(() => {});
        await this.waitForRoutesPageReady(5000).catch(() => {});
    } else {
        // Absolute fallback: Refresh page and re-login if needed (handled by main try/catch)
        console.error(`${logPrefix} Dashboard blocked. Forcing page refresh.`);
        await this.page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    }
  }

  private appendSummary(markdown: string): void {
    if (!this.githubStepSummary) return;
    try {
      appendFileSync(this.githubStepSummary, markdown + '\n\n');
    } catch {}
  }
}
