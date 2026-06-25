import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";



export class MaintenanceUtils {
    page: Page;
    repairThreshold: string;

    constructor(page: Page) {
        this.page = page;
        this.repairThreshold = process.env.REPAIR_THRESHOLD_PERCENT ?? '30';
    }



    private async openPlanningMenu() {
        await this.page.getByRole('button', { name: ' Plan' }).click();
        await GeneralUtils.sleep(500);
    }

    public async repairPlanes() {
        await this.openPlanningMenu();
        await this.page.getByRole('button', { name: ' Bulk repair' }).click();
        await this.page.locator('#repairPct').selectOption(this.repairThreshold);
        await GeneralUtils.sleep(1000);

        const noPlaneExists = await this.page.getByText('There are no aircraft worn to').isVisible().catch(() => false);
        if (!noPlaneExists) {
            await this.page.getByRole('button', { name: 'Plan bulk repair' }).click();
            return true;
        }

        return false;
    }

    public async checkPlanes() {
        await this.openPlanningMenu();
        await this.page.getByRole('button', { name: ' Bulk check' }).click();

        // Wait for the modal content to appear
        await this.page.locator('.modal-body').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        await GeneralUtils.sleep(1000); 

        let clicked = false;
        
        // Find all red (danger) check buttons that indicate maintenance is due
        const dangerButtons = this.page.locator('.bg-white > .text-danger');
        
        // Use all() to get a snapshot of elements to avoid "Element Detached" errors during iteration
        const elements = await dangerButtons.all();
        console.log(`Found ${elements.length} maintenance items to check.`);
        
        for (const element of elements) {
            if (await element.isVisible()) {
                await element.click();
                clicked = true;
                // Tiny buffer for UI update
                await this.page.waitForTimeout(300);
            }
        }

        if (clicked) {
            await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
            await GeneralUtils.sleep(1000);
        }

        return clicked;
    }

    public async prepareFlightsForDeparture() {
        const checksPlanned = await this.checkPlanes();
        await GeneralUtils.sleep(1000);
        const repairsPlanned = await this.repairPlanes();
        await GeneralUtils.sleep(1000);

        return {
            checksPlanned,
            repairsPlanned,
            workScheduled: checksPlanned || repairsPlanned,
        };
    }


}
