import * as fs from 'fs';
import * as path from 'path';
import { Locator, Page } from "@playwright/test";
import { ConfigUtils } from "./config.utils";
import { GeneralUtils } from "./general.utils";




type ResourceType = 'fuel' | 'co2';

type PriceHistoryEntry = {
    timestamp: string;
    price: number;
};

type PlannedDepartureSnapshot = {
    capturedAt: string;
    departuresInNext24Hours: number;
    departuresInNext48Hours: number;
    departuresInNext7Days: number;
    averageDeparturesPerHour: number;
};

type PriceHistoryFile = {
    fuel: PriceHistoryEntry[];
    co2: PriceHistoryEntry[];
};

type MarketDecision = {
    shouldBuy: boolean;
    quantity: number;
    reason: string;
};

export class FuelUtils {
    maxFuelPrice: number;
    maxCo2Price: number;
    minimumFuelCoverHours: number;
    minimumCo2CoverHours: number;
    maxPriceHistoryEntries: number;
    averageFuelBurnPerDeparture: number;
    averageCo2BurnPerDeparture: number;
    marketHistoryFile: string;
    plannedDepartureSnapshot: PlannedDepartureSnapshot | null;

    page: Page;

    constructor(page: Page) {
        this.maxFuelPrice = ConfigUtils.requireNumber('MAX_FUEL_PRICE');
        this.maxCo2Price = ConfigUtils.requireNumber('MAX_CO2_PRICE');
        this.minimumFuelCoverHours = ConfigUtils.optionalNumber('MINIMUM_FUEL_COVER_HOURS', 12);
        this.minimumCo2CoverHours = ConfigUtils.optionalNumber('MINIMUM_CO2_COVER_HOURS', 24);
        this.maxPriceHistoryEntries = ConfigUtils.optionalNumber('MAX_PRICE_HISTORY_ENTRIES', 200);
        this.averageFuelBurnPerDeparture = ConfigUtils.optionalNumber('AVERAGE_FUEL_BURN_PER_DEPARTURE', 250000);
        this.averageCo2BurnPerDeparture = ConfigUtils.optionalNumber('AVERAGE_CO2_BURN_PER_DEPARTURE', 100000);
        this.marketHistoryFile = ConfigUtils.optionalString('MARKET_HISTORY_FILE', path.join(process.cwd(), '.cache', 'market-history.json'));
        this.plannedDepartureSnapshot = null;
        this.page = page;

        console.log(`Fuel intelligence configured from in-game market prices only. Fuel cap=${this.maxFuelPrice}, CO2 cap=${this.maxCo2Price}, history file=${this.marketHistoryFile}`);
    }

    public async analyzePlannedDepartures() {
        console.log('Analyzing planned departures for market intelligence...');

        const rowTexts = await this.collectPotentialDepartureTexts();
        const now = new Date();

        let departuresInNext24Hours = 0;
        let departuresInNext48Hours = 0;
        let departuresInNext7Days = 0;

        for (const rowText of rowTexts) {
            const hoursUntilDeparture = this.extractHoursUntilDeparture(rowText, now);
            if (hoursUntilDeparture === null) {
                continue;
            }

            if (hoursUntilDeparture <= 24) {
                departuresInNext24Hours++;
            }
            if (hoursUntilDeparture <= 48) {
                departuresInNext48Hours++;
            }
            if (hoursUntilDeparture <= 24 * 7) {
                departuresInNext7Days++;
            }
        }

        const averageDeparturesPerHour = departuresInNext24Hours > 0
            ? departuresInNext24Hours / 24
            : Math.max(departuresInNext48Hours / 48, departuresInNext7Days / (24 * 7), 1 / 24);

        this.plannedDepartureSnapshot = {
            capturedAt: now.toISOString(),
            departuresInNext24Hours,
            departuresInNext48Hours,
            departuresInNext7Days,
            averageDeparturesPerHour,
        };

        console.log(`Planned departures snapshot: 24h=${departuresInNext24Hours}, 48h=${departuresInNext48Hours}, 7d=${departuresInNext7Days}, avg/hr=${averageDeparturesPerHour.toFixed(3)}`);
    }

    public async buyFuel() {
        console.log('Buying Fuel...');

        const state = await this.readMarketState();
        if (state.emptyCapacity === 0) {
            return;
        }

        const history = this.recordPriceHistory('fuel', state.currentPrice);
        const percentile = this.calculatePricePercentile(history, state.currentPrice);
        const estimatedUsagePerHour = this.estimateUsagePerHour('fuel');
        const coverHours = this.calculateCoverHours(state.currentHolding, estimatedUsagePerHour);
        const decision = this.decidePurchase({
            resource: 'fuel',
            currentPrice: state.currentPrice,
            currentHolding: state.currentHolding,
            emptyCapacity: state.emptyCapacity,
            maxAcceptedPrice: this.maxFuelPrice,
            percentile,
            minimumCoverHours: this.minimumFuelCoverHours,
            estimatedUsagePerHour,
        });

        console.log(`Fuel cover=${coverHours.toFixed(2)}h, percentile=${percentile.toFixed(1)}, usage/hr=${estimatedUsagePerHour.toFixed(0)}.`);
        await this.executePurchaseIfNeeded('fuel', decision);
    }

    public async buyCo2() {
        console.log('Buying CO2...');

        const state = await this.readMarketState();
        if (state.emptyCapacity === 0 && state.currentHolding >= 0) {
            return;
        }

        const history = this.recordPriceHistory('co2', state.currentPrice);
        const percentile = this.calculatePricePercentile(history, state.currentPrice);
        const estimatedUsagePerHour = this.estimateUsagePerHour('co2');
        const coverHours = this.calculateCoverHours(state.currentHolding, estimatedUsagePerHour);
        const decision = this.decidePurchase({
            resource: 'co2',
            currentPrice: state.currentPrice,
            currentHolding: state.currentHolding,
            emptyCapacity: state.emptyCapacity,
            maxAcceptedPrice: this.maxCo2Price,
            percentile,
            minimumCoverHours: this.minimumCo2CoverHours,
            estimatedUsagePerHour,
        });

        console.log(`CO2 cover=${coverHours.toFixed(2)}h, percentile=${percentile.toFixed(1)}, usage/hr=${estimatedUsagePerHour.toFixed(0)}.`);
        await this.executePurchaseIfNeeded('co2', decision);
    }

    private async collectPotentialDepartureTexts(): Promise<string[]> {
        const selectors = [
            'tr',
            '.route',
            '.route-row',
            '.flight',
            '.flight-row',
            '.list-group-item',
        ];

        for (const selector of selectors) {
            const locator = this.page.locator(selector);
            const count = await locator.count();
            if (count === 0) {
                continue;
            }

            const texts = await locator.allInnerTexts();
            const filtered = texts
                .map(text => text.replace(/\s+/g, ' ').trim())
                .filter(text => /depart|flight|route|gate|eta|remaining|hour|min/i.test(text));

            if (filtered.length > 0) {
                return filtered;
            }
        }

        return [];
    }

    private extractHoursUntilDeparture(text: string, now: Date): number | null {
        const lowerText = text.toLowerCase();

        const daysHoursMinutes = lowerText.match(/(\d+)d\s*(\d+)h\s*(\d+)m/);
        if (daysHoursMinutes) {
            return Number.parseInt(daysHoursMinutes[1], 10) * 24 + Number.parseInt(daysHoursMinutes[2], 10) + Number.parseInt(daysHoursMinutes[3], 10) / 60;
        }

        const hoursMinutes = lowerText.match(/(\d+)h\s*(\d+)m/);
        if (hoursMinutes) {
            return Number.parseInt(hoursMinutes[1], 10) + Number.parseInt(hoursMinutes[2], 10) / 60;
        }

        const minutesOnly = lowerText.match(/(\d+)m/);
        if (minutesOnly && /depart|remaining|eta|next/i.test(lowerText)) {
            return Number.parseInt(minutesOnly[1], 10) / 60;
        }

        const absoluteMatch = text.match(/(\d{1,2})[:.](\d{2})/);
        if (absoluteMatch && /depart|next|schedule/i.test(lowerText)) {
            const departureTime = new Date(now);
            departureTime.setUTCHours(Number.parseInt(absoluteMatch[1], 10), Number.parseInt(absoluteMatch[2], 10), 0, 0);
            if (departureTime.getTime() < now.getTime()) {
                departureTime.setUTCDate(departureTime.getUTCDate() + 1);
            }

            return (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        }

        return null;
    }

    private async readMarketState() {
        return {
            currentPrice: await this.readInteger(this.page.locator('b > span:visible').filter({ hasText: /\d+/ }).first()),
            currentHolding: await this.readInteger(this.page.locator('#holding:visible')),
            emptyCapacity: await this.readInteger(this.page.locator('#remCapacity:visible')),
        };
    }

    private async readInteger(locator: Locator): Promise<number> {
        const rawText = (await locator.innerText()).replace(/,/g, '').trim();
        const match = rawText.match(/-?\d+/);
        return match ? Number.parseInt(match[0], 10) : 0;
    }

    private recordPriceHistory(resource: ResourceType, price: number): number[] {
        const history = this.readPriceHistory();
        const resourceHistory = history[resource];

        resourceHistory.push({
            timestamp: new Date().toISOString(),
            price,
        });

        history[resource] = resourceHistory.slice(-this.maxPriceHistoryEntries);
        GeneralUtils.atomicWriteFileSync(this.marketHistoryFile, JSON.stringify(history, null, 2));

        return history[resource].map(entry => entry.price);
    }

    private readPriceHistory(): PriceHistoryFile {
        if (!fs.existsSync(this.marketHistoryFile)) {
            return { fuel: [], co2: [] };
        }

        try {
            const rawContent = fs.readFileSync(this.marketHistoryFile, 'utf8');
            const parsedContent = JSON.parse(rawContent) as Partial<PriceHistoryFile>;

            return {
                fuel: parsedContent.fuel ?? [],
                co2: parsedContent.co2 ?? [],
            };
        } catch (error) {
            console.warn(`Failed to read market history file ${this.marketHistoryFile}. Resetting cache.`, error);
            return { fuel: [], co2: [] };
        }
    }

    private calculatePricePercentile(history: number[], currentPrice: number): number {
        if (history.length <= 1) {
            return 50;
        }

        const cheaperOrEqualSamples = history.filter(price => price <= currentPrice).length;
        return (cheaperOrEqualSamples / history.length) * 100;
    }

    private estimateUsagePerHour(resource: ResourceType): number {
        const snapshot = this.plannedDepartureSnapshot;
        const departuresPerHour = snapshot?.averageDeparturesPerHour ?? (1 / 24);
        const averageBurnPerDeparture = resource === 'fuel' ? this.averageFuelBurnPerDeparture : this.averageCo2BurnPerDeparture;

        return Math.max(departuresPerHour * averageBurnPerDeparture, 1);
    }

    private calculateCoverHours(currentHolding: number, estimatedUsagePerHour: number): number {
        if (currentHolding <= 0) {
            return 0;
        }

        return currentHolding / estimatedUsagePerHour;
    }

    private decidePurchase(input: {
        resource: ResourceType;
        currentPrice: number;
        currentHolding: number;
        emptyCapacity: number;
        maxAcceptedPrice: number;
        percentile: number;
        minimumCoverHours: number;
        estimatedUsagePerHour: number;
    }): MarketDecision {
        const currentCoverHours = this.calculateCoverHours(input.currentHolding, input.estimatedUsagePerHour);
        const isNegativeCo2 = input.resource === 'co2' && input.currentHolding < 0;

        if (input.currentPrice <= input.maxAcceptedPrice) {
            return {
                shouldBuy: input.emptyCapacity > 0,
                quantity: input.emptyCapacity,
                reason: `${input.resource.toUpperCase()} price is at or below the configured threshold, buying to full remaining capacity.`,
            };
        }

        if (isNegativeCo2) {
            const bufferedQuantity = this.calculateNegativeCo2BufferPurchase(input.currentHolding, input.emptyCapacity);

            return {
                shouldBuy: bufferedQuantity > 0,
                quantity: bufferedQuantity,
                reason: 'CO2 holding is negative, buying a buffered amount before departures even though the market is above the configured threshold.',
            };
        }

        if (currentCoverHours < input.minimumCoverHours) {
            return {
                shouldBuy: input.emptyCapacity > 0,
                quantity: input.emptyCapacity,
                reason: `${input.resource.toUpperCase()} cover is below the minimum threshold, buying to full remaining capacity.`,
            };
        }

        return {
            shouldBuy: false,
            quantity: 0,
            reason: `${input.resource.toUpperCase()} cover is healthy, skipping additional purchases.`,
        };
    }

    private async executePurchaseIfNeeded(resource: ResourceType, decision: MarketDecision) {
        console.log(`${resource.toUpperCase()} decision: ${decision.reason}`);
        if (!decision.shouldBuy) {
            return;
        }

        await this.page.getByPlaceholder('Amount to purchase').click();
        await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
        await this.page.getByPlaceholder('Amount to purchase').fill(String(decision.quantity));
        await this.page.getByRole('button', { name: ' Purchase' }).click();

        console.log(`Bought ${resource.toUpperCase()} successfully. Amount purchased: ${decision.quantity}.`);
        await GeneralUtils.sleep(1000);

        if (resource === 'co2') {
            await this.ensureCo2IsNonNegative();
        }
    }

    private async ensureCo2IsNonNegative() {
        for (let attempt = 0; attempt < 3; attempt++) {
            const state = await this.readMarketState();
            if (state.currentHolding >= 0) {
                return;
            }

            const additionalQuantity = this.calculateNegativeCo2BufferPurchase(state.currentHolding, state.emptyCapacity);
            if (additionalQuantity <= 0) {
                return;
            }

            console.log(`CO2 holding is still negative after purchase (${state.currentHolding}). Buying ${additionalQuantity} more as a buffered top-up.`);
            await this.page.getByPlaceholder('Amount to purchase').click();
            await this.page.getByPlaceholder('Amount to purchase').press('Control+a');
            await this.page.getByPlaceholder('Amount to purchase').fill(String(additionalQuantity));
            await this.page.getByRole('button', { name: ' Purchase' }).click();
            await GeneralUtils.sleep(1000);
        }
    }

    private calculateNegativeCo2BufferPurchase(currentHolding: number, emptyCapacity: number): number {
        const deficit = Math.abs(Math.min(currentHolding, 0));
        // If we are in debt, we should at least buy the deficit amount.
        // We also want a buffer of half the remaining capacity if possible.
        const halfRemainingCapacity = Math.ceil(Math.max(emptyCapacity, 0) * 0.5);

        // Ensure we buy at least the deficit, but never more than the total room available.
        // If emptyCapacity is 0, we can't buy, but in AM4 if you are in debt, 
        // the capacity usually allows buying at least up to the max.
        const quantity = Math.max(deficit, halfRemainingCapacity);
        return Math.min(quantity, Math.max(emptyCapacity, 0));
    }
}
