import {SimpleHandler} from './main';
import {RequestType} from './types';
import {environment} from '../../../environment';

interface ListItemRequest {
    asset_id: string;
    price: number;
}

interface ListItemResponse {
    success: boolean;
    error?: string;
}

export const ListItem = new SimpleHandler<ListItemRequest, ListItemResponse>(RequestType.LIST_ITEM, async (req) => {
    // TODO: implement according to https://docs.csfloat.com/#list-an-item
    return {
        success: true,
    };
});
