import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

export class MaintenanceUtils {
    page : Page;

    constructor(page : Page) {
        this.page = page;
    }

    public async repairPlanes() {
        await this.page.getByRole('button', { name: ' Plan' }).click();
        await this.page.getByRole('button', { name: ' Bulk repair' }).click();
        await this.page.locator('#repairPct').selectOption('60');
        await GeneralUtils.sleep(1000);
        const noPlaneExists = await this.page.getByText('There are no aircraft worn to').isVisible();
        if(!noPlaneExists) {
            await this.page.getByRole('button', { name: 'Plan bulk repair' }).click();
        }
    }

    public async checkPlanes() {
        await this.page.getByRole('button', { name: ' Plan' }).click();
        await this.page.getByRole('button', { name: ' Bulk check' }).click();

        await GeneralUtils.sleep(2000);
        let clicked = false;

        // Click only planes with danger text
        const dangerChecksExits = await this.page.locator('.bg-white > .text-danger').first().isVisible();
        if(dangerChecksExits) {
            const allCheckHoursDanger = await this.page.locator('.bg-white > .text-danger');
            let count = await allCheckHoursDanger.count();        
            for(let i = 0; i < count; i++) {
                const element = await allCheckHoursDanger.first();

                await element.click();
                clicked = true;

                await GeneralUtils.sleep(500);
            }
        }

        if(clicked) {
            await this.page.getByRole('button', { name: 'Plan bulk check' }).click();
        }
    }
}