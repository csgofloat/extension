import {SimpleHandler} from './main';
import {RequestType} from './types';
import {gPriceFetcher} from '../../services/price_fetcher';

export interface FetchRecommendedPriceRequest {
    market_hash_name: string;
}

export interface FetchRecommendedPriceResponse {
    price: number;
}

export const FetchRecommendedPrice = new SimpleHandler<FetchRecommendedPriceRequest, FetchRecommendedPriceResponse>(
    RequestType.FETCH_RECOMMENDED_PRICE,
    async (req) => ({price: await gPriceFetcher.fetch(req.market_hash_name)})
);
