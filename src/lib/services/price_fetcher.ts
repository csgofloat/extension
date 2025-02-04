import {environment} from '../../environment';
import {gStore} from '../storage/store';
import {PRICE_CACHE} from '../storage/keys';

const DEFAULT_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours

interface PriceListResponse {
    market_hash_name: string;
    min_price: number;
}

interface PriceCache {
    timestamp: number;
    prices: Record<string, number>;
}

class PriceFetcher {
    async fetch(market_hash_name: string): Promise<number> {
        const prices = await this.getValidPrices();
        return prices[market_hash_name] || 0;
    }

    private async getValidPrices(): Promise<Record<string, number>> {
        const now = Date.now();

        // Try loading from storage first
        const storedCache = await gStore.getWithStorage<PriceCache>(chrome.storage.local, PRICE_CACHE.key);
        if (storedCache && now - storedCache.timestamp < DEFAULT_CACHE_DURATION) {
            return storedCache.prices;
        }

        try {
            // Fetch new prices if needed
            const response = await fetch(`${environment.csfloat_base_api_url}/v1/listings/price-list`, {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch prices: ${response.status}`);
            }

            const data = (await response.json()) as PriceListResponse[];

            // Build new cache
            const prices: Record<string, number> = {};
            for (const item of data) {
                prices[item.market_hash_name] = item.min_price;
            }

            await gStore.setWithStorage(chrome.storage.local, PRICE_CACHE.key, {
                timestamp: now,
                prices,
            });

            return prices;
        } catch (error) {
            // On error, return existing cache regardless of age, or empty object if no cache exists
            return storedCache?.prices || {};
        }
    }
}

export const gPriceFetcher = new PriceFetcher();
