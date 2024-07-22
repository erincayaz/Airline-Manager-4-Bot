import { Page } from "@playwright/test";

require('dotenv').config();

export class FuelUtils {
    maxFuelPrice : number;
    maxCo2Price : number;

    page : Page;

    constructor(page : Page) {
        this.maxFuelPrice = parseInt(process.env.MAX_FUEL_PRICE!);
        this.maxCo2Price = parseInt(process.env.MAX_CO2_PRICE!);
        this.page = page;

        console.log("Max Fuel Price: " + this.maxFuelPrice);
        console.log("Max Co2 Price: " + this.maxCo2Price);
    }

    public async buyFuel() {
        console.log('Buying Fuel...')

        const getCurrentFuelPrice = async () => {
            let fuelText = await this.page.getByText('Total price$').locator('b > span').innerText();
            fuelText = fuelText.replaceAll(',', '');
            
            return parseInt(fuelText);
        }

        const getCurrentHolding = async () => {
            let holdingText = await this.page.locator('#holding').innerText();
            holdingText = holdingText.replaceAll(',', '');

            return parseInt(holdingText);
        }

        const getEmptyFuel = async () => {
            const emptyText = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '')

            return parseInt(emptyText);
        }

        const emptyFuel = await getEmptyFuel();
        if(emptyFuel === 0) {
            return;
        }

        const curFuelPrice = await getCurrentFuelPrice();
        const curHolding = await getCurrentHolding();

        console.log('Current Fuel Price: ' + curFuelPrice);

        // Buy fuel if current price is lower than max price
        if(curFuelPrice < this.maxFuelPrice) {
            const emptyFuelCapacity = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '');

            await this.page.getByPlaceholder('Amount to purchase').click();
            await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
            await this.page.getByPlaceholder('Amount to purchase').fill(emptyFuelCapacity);
            await this.page.getByRole('button', { name: ' Purchase' }).click();

            console.log('Bought Fuel Successfully! Amount of fuel bought: ' + emptyFuelCapacity + ' Litres');
        }
        else if(curHolding < 2000000 && curFuelPrice < 1250) {
            const emptyFuelCapacity = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '');

            await this.page.getByPlaceholder('Amount to purchase').click();
            await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
            await this.page.getByPlaceholder('Amount to purchase').fill('2000000');
            await this.page.getByRole('button', { name: ' Purchase' }).click();

            console.log('Bought Fuel Successfully! Amount of fuel bought: 2000000 Litres');
        } 
    }

    public async buyCo2() {
        const getCurrentCo2Price = async () => {
            let co2Text = await this.page.getByText('Total price$').locator('b > span').innerText();
            co2Text = co2Text.replaceAll(',', '');
            
            return parseInt(co2Text);
        }

        const getCurrentHolding = async () => {
            let holdingText = await this.page.locator('#holding').innerText();
            holdingText = holdingText.replaceAll(',', '');

            return parseInt(holdingText);
        }

        const getEmptyCO2 = async () => {
            const emptyText = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '')

            return parseInt(emptyText);
        }

        const emptyCo2 = await getEmptyCO2();
        if(emptyCo2 === 0) {
            return;
        }

        const curCo2Price = await getCurrentCo2Price();
        const curHolding = await getCurrentHolding();

        console.log('Current Co2 Price: ' + curCo2Price);

        // Buy co2 if current price is lower than max price
        if(curCo2Price < this.maxCo2Price) {
            const emptyCo2Capacity = (await this.page.locator('#remCapacity').innerText()).replaceAll(',', '');

            await this.page.getByPlaceholder('Amount to purchase').click();
            await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
            await this.page.getByPlaceholder('Amount to purchase').fill(emptyCo2Capacity);
            await this.page.getByRole('button', { name: ' Purchase' }).click();

            console.log('Bought Co2 Successfully! Amount of co2 bought: ' + emptyCo2Capacity);
        }
        else if(curHolding < 1000000 && curCo2Price < 180) {
            await this.page.getByPlaceholder('Amount to purchase').click();
            await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
            await this.page.getByPlaceholder('Amount to purchase').fill('1000000');
            await this.page.getByRole('button', { name: ' Purchase' }).click();

            console.log('Bought Co2 Successfully! Amount of co2 bought: 1000000');
        }
    }
}