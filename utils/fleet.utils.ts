import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

require('dotenv').config();

export class FleetUtils {
    page : Page;
    maxTry : number; // Added to prevent infinite loop in case of no fuel available

    constructor(page : Page) {
        this.page = page;
        this.maxTry = 8; // TODO: Find another way 
    }

    public async departPlanes() {
        let departAllVisible = await this.page.locator('#departAll').isVisible();
        console.log('Looking if there are any planes to be departed...')

        let count = 0; 
        while(departAllVisible && count < this.maxTry) {
            console.log('Departing 20 or less...');

            let departAll = await this.page.locator('#departAll');
            
            await departAll.click();
            await GeneralUtils.sleep(1500);
            
            const cantDepartPlane = await this.page.getByText('×Unable to departSome A/C was').isVisible();
            if(cantDepartPlane)
                break;

            departAllVisible = await this.page.locator('#departAll').isVisible();
            count++;
        
            console.log('Departed 20 or less planes...')
        }
    }
}