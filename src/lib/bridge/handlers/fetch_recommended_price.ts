import {SimpleHandler} from './main';
import {RequestType} from './types';
import {environment} from '../../../environment';
import MessageSender = chrome.runtime.MessageSender;

export interface CSFloatListing {
    id: string;
    created_at: string;
    type: 'buy_now' | 'auction';
    price: number; // in cents
    state: string;
    item: {
        market_hash_name: string;
    };
}

export interface FetchRecommendedPriceRequest {
    market_hash_name: string;
}

export interface FetchRecommendedPriceResponse {
    price: number;
}

const MIN_LISTINGS_FOR_AVERAGE = 3;
const MAX_LISTINGS_TO_FETCH = 50;

async function fetchRecommendedPrice(
    req: FetchRecommendedPriceRequest,
    sender: MessageSender
): Promise<FetchRecommendedPriceResponse> {
    // Build query parameters
    const params: Record<string, string> = {
        market_hash_name: req.market_hash_name,
        limit: MAX_LISTINGS_TO_FETCH.toString(),
        sort_by: 'lowest_price',
        type: 'buy_now',
    };

    const url = `${environment.csfloat_base_api_url}/v1/listings?${new URLSearchParams(params)}`;
    console.log('[FetchRecommendedPrice] Request URL:', url);
    console.log('[FetchRecommendedPrice] Request params:', params);

    try {
        const response = await fetch(url, {
            credentials: 'include',
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('[FetchRecommendedPrice] API error:', response.status, text);
            return {
                price: 0,
            };
        }

        const data = await response.json();
        const listings = (data.data || []) as CSFloatListing[];

        if (listings.length === 0) {
            return {
                price: 0,
            };
        }

        // Calculate the average price of the lowest N listings
        const numListings = Math.min(MIN_LISTINGS_FOR_AVERAGE, listings.length);
        const lowestPricedListings = listings.slice(0, numListings); // Already sorted by lowest_price from API

        const totalPrice = lowestPricedListings.reduce(
            (sum: number, listing: CSFloatListing) => sum + listing.price,
            0
        );
        const averagePrice = totalPrice / numListings;

        console.log('[FetchRecommendedPrice] Calculated price:', {
            price: averagePrice,
            listings_considered: lowestPricedListings.map((l) => ({
                price: l.price,
            })),
        });

        return {
            price: averagePrice,
        };
    } catch (error) {
        console.error('[FetchRecommendedPrice] Error fetching listings:', error);
        return {
            price: 0,
        };
    }
}

export const FetchRecommendedPrice = new SimpleHandler<FetchRecommendedPriceRequest, FetchRecommendedPriceResponse>(
    RequestType.FETCH_RECOMMENDED_PRICE,
    fetchRecommendedPrice
);
