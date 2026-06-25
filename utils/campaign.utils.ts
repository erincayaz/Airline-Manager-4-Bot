import { Page } from "@playwright/test";
import { GeneralUtils } from "./general.utils";

const ECO_FRIENDLY_DURATION_HOURS = 12;
const ECO_FRIENDLY_DURATION_OPTION = (ECO_FRIENDLY_DURATION_HOURS / 4).toString();

export class CampaignUtils {
    page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    private async createEcoFriendly() {
        const isEcoFriendlyExists = await this.page.getByRole('cell', { name: ' Eco friendly' }).isVisible().catch(() => false);
        if (isEcoFriendlyExists) {
            console.log('Eco Friendly campaign is already active.');
            return;
        }

        await this.page.getByRole('button', { name: ' New campaign' }).click();
        await this.page.getByRole('cell', { name: 'Eco-friendly Increases' }).click();

        const durationSelector = this.page.locator('#dSelector');
        if (await durationSelector.isVisible().catch(() => false)) {
            await durationSelector.selectOption(ECO_FRIENDLY_DURATION_OPTION);
        }

        await this.page.getByRole('button', { name: '$' }).click();
        console.log(`Eco Friendly campaign created successfully for ${ECO_FRIENDLY_DURATION_HOURS} hours.`);
    }

    public async createCampaign() {
        console.log('Create Campaign Started...');

        await this.page.getByRole('button', { name: ' Marketing' }).click();
        // Wait for the 'New campaign' button to appear as a signal the modal is ready
        await this.page.getByRole('button', { name: ' New campaign' }).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

        await this.createEcoFriendly();

        console.log('Campaign Created Finished!');
    }
}
