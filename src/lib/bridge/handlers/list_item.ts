import {SimpleHandler} from './main';
import {RequestType} from './types';
import {environment} from '../../../environment';

type ListingType = 'buy_now' | 'auction';

interface BaseListItemRequest {
    asset_id: string;
    type: ListingType;
    description?: string;
    private?: boolean;
}

interface BuyNowListItemRequest extends BaseListItemRequest {
    type: 'buy_now';
    price: number;
    max_offer_discount?: number;
}

interface AuctionListItemRequest extends BaseListItemRequest {
    type: 'auction';
    reserve_price: number;
    duration_days: 1 | 3 | 5 | 7 | 14;
}

type ListItemRequest = BuyNowListItemRequest | AuctionListItemRequest;

interface ListItemResponse {
    success: boolean;
    error?: string;
}

export const ListItem = new SimpleHandler<ListItemRequest, ListItemResponse>(RequestType.LIST_ITEM, async (req) => {
    const response = await fetch(`${environment.csfloat_base_api_url}/v1/listings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(req),
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to list item');
    }

    return {
        success: true,
    };
});
