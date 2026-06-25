export class ConfigUtils {
    public static requireString(name: string): string {
        const value = process.env[name]?.trim();

        if (!value) {
            throw new Error(`Missing required environment variable: ${name}`);
        }

        return value;
    }

    public static requireNumber(name: string): number {
        const value = this.requireString(name);
        const parsedValue = Number.parseInt(value, 10);

        if (Number.isNaN(parsedValue)) {
            throw new Error(`Environment variable ${name} must be a valid integer.`);
        }

        return parsedValue;
    }

    public static optionalString(name: string, defaultValue = ''): string {
        return process.env[name]?.trim() || defaultValue;
    }

    public static optionalNumber(name: string, defaultValue: number): number {
        const value = process.env[name]?.trim();
        if (!value) {
            return defaultValue;
        }

        const parsedValue = Number.parseInt(value, 10);
        if (Number.isNaN(parsedValue)) {
            throw new Error(`Environment variable ${name} must be a valid integer.`);
        }

        return parsedValue;
    }

    public static optionalJson<T>(name: string, defaultValue: T): T {
        const value = process.env[name]?.trim();
        if (!value) {
            return defaultValue;
        }

        try {
            return JSON.parse(value) as T;
        } catch (error) {
            throw new Error(`Environment variable ${name} must contain valid JSON. ${error}`);
        }
    }

    public static optionalBoolean(name: string, defaultValue: boolean): boolean {
        const value = process.env[name]?.trim();
        if (!value) {
            return defaultValue;
        }

        const normalizedValue = value.toLowerCase();
        if (normalizedValue === 'true') {
            return true;
        }
        if (normalizedValue === 'false') {
            return false;
        }

        throw new Error(`Environment variable ${name} must be either "true" or "false".`);
    }
}
