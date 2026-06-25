import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";
import { MaintenanceUtils } from "./maintenance.utils";



export class FleetUtils {
    page: Page;
    maxTry: number; // Added to prevent infinite loop
    maintenanceUtils: MaintenanceUtils;
    generalUtils: GeneralUtils;

    constructor(page: Page) {
        this.page = page;
        this.maxTry = 8;
        this.maintenanceUtils = new MaintenanceUtils(page);
        this.generalUtils = new GeneralUtils(page);
    }

    private async getDepartureModalText(): Promise<string> {
        const popup = this.page.locator('.sweet-alert:visible, .alert:visible, #error:visible').first();
        if (await popup.isVisible().catch(() => false)) {
            const modalText = await popup.innerText().catch(() => '');
            if (modalText) {
                console.log(`Departure alert says: ${modalText.substring(0, 150).replace(/\n/g, ' ')}`);
            }
            return modalText.replace(/\s+/g, ' ').trim().toLowerCase();
        }
        return '';
    }

    private maintenanceBlockingDeparture(modalText: string): boolean {
        if (!modalText.includes('unable to depart')) {
            return false;
        }

        const overdueACheckPatterns = [
            /some a\/c was due for a-check/i,
            /aircraft .* due for a-check/i,
            /a-check .* due/i,
        ];

        const repairThresholdPatterns = [
            /some a\/c was worn to/i,
            /aircraft .* worn to/i,
            /repair required/i,
        ];

        return [...overdueACheckPatterns, ...repairThresholdPatterns].some((pattern) => pattern.test(modalText));
    }

    private async scheduleMaintenanceAndReturnToRoutes() {
        await this.generalUtils.closePopupIfOpen();
        await this.page.locator('div:nth-child(4) > #mapMaint > img').click();
        await GeneralUtils.sleep(1500);
        const summary = await this.maintenanceUtils.prepareFlightsForDeparture();
        await this.generalUtils.closePopupIfOpen();
        await this.page.locator('#mapRoutes').getByRole('img').click();
        await GeneralUtils.sleep(2500);
        return summary;
    }

    public async departPlanes() {
        console.log('Preparing flights for departure with A-check and repair scheduling...');
        await this.scheduleMaintenanceAndReturnToRoutes();

        const departAllSelector = '#departAll';
        let departAllVisible = await this.page.locator(departAllSelector).isVisible().catch(() => false);
        console.log('Looking if there are any planes to be departed...');

        let count = 0;
        while (departAllVisible && count < this.maxTry) {
            console.log(`Departure attempt ${count + 1} of ${this.maxTry}...`);

            const departAll = this.page.locator(departAllSelector);
            await departAll.click();

            // Wait specifically for the button to either disappear OR a success/error modal to appear
            await Promise.all([
                this.page.waitForResponse(response => response.url().includes('depart') && response.status() === 200, { timeout: 8000 }).catch(() => {}),
                Promise.any([
                    this.page.locator('.sweet-alert:visible, .alert:visible, #error:visible').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
                    departAll.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {})
                ])
            ]);
            
            await this.page.waitForTimeout(1000); 

            const modalText = await this.getDepartureModalText();
            const maintenanceBlocked = this.maintenanceBlockingDeparture(modalText);

            if (maintenanceBlocked) {
                console.log('Departure blocked by due A-check or repair threshold; scheduling maintenance before retrying.');
                const summary = await this.scheduleMaintenanceAndReturnToRoutes();
                if (!summary.workScheduled) {
                    console.log('No additional maintenance could be scheduled, stopping departure attempts.');
                    break;
                }
            } else if (modalText !== '') {
                if (modalText.includes('fuel') || modalText.includes('co2') || modalText.includes('quota')) {
                    console.log(`Departure blocked by resource constraints: ${modalText}`);
                    await this.generalUtils.closePopupIfOpen();
                    break;
                }
                await this.generalUtils.closePopupIfOpen();
            }

            await GeneralUtils.sleep(1000);
            departAllVisible = await this.page.locator(departAllSelector).isVisible().catch(() => false);
            count++;
        }
        
        console.log('Departure phase complete.');
    }
}
