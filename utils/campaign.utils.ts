import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

export class CampaignUtils {
    page: Page;

    increaseAirlineReputation: boolean = false;
    campaignType: number = 1;
    campaignDuration: number = 4;

    constructor(page: Page) {
        if(process.env.INCREASE_AIRLINE_REPUTATION === 'true') {
            this.increaseAirlineReputation = true;
            this.campaignType = parseInt(process.env.CAMPAIGN_TYPE!);
            this.campaignDuration = parseInt(process.env.CAMPAIGN_DURATION!);
        }

        this.page = page;
    }

    private async createEcoFriendly() {
        const isEcoFriendExists = await this.page.getByRole('cell', { name: ' Eco friendly' }).isVisible();
        if(!isEcoFriendExists) {
            await this.page.getByRole('button', { name: ' New campaign' }).click();
            await this.page.getByRole('cell', { name: 'Eco-friendly Increases' }).click();
            await this.page.getByRole('button', { name: '$' }).click();

            console.log("Eco Friendly Campaign Created Successfully!");
        }
    }

    private async createReputation() {
        const campaignType = this.campaignType.toString();
        const durationOption = (Math.floor(this.campaignDuration / 4) || 1).toString();

        const isAirlineReputationExists = await this.page.getByRole('cell', { name: ' Airline reputation' }).isVisible();
        if (!isAirlineReputationExists) {
            await this.page.getByRole('button', { name: ' New campaign' }).click();
            await this.page.getByRole('cell', { name: 'Increase airline reputation' }).click();
            await this.page.locator('#dSelector').selectOption(durationOption);
            await this.page.locator(`tr:has(td:has-text("Campaign ${campaignType}")) .btn-danger`).click();

            console.log("Increased Airline Reputation Successfully!");
        }
    }

    public async createCampaign() {
        console.log('Create Campaing Started...')

        await this.page.getByRole('button', { name: ' Marketing' }).click();

        await GeneralUtils.sleep(1000);

        await this.createEcoFriendly();

        if(this.increaseAirlineReputation) {
            await this.createReputation();
        }

        console.log('Campaign Created Finished!');
    }
}