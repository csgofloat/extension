/**
 * Keys for use as the raw "key" in local/sync storage for a row
 */
import {SerializedFilter} from '../filter/types';

export enum StorageKey {
    // Backwards compatible with <3.0.0
    PAGE_SIZE = 'pageSize',
    ITEM_FILTERS = 'expressions',
    GLOBAL_FILTERS = 'global',
    ACCESS_TOKEN = 'access_token',
    LAST_TRADE_PING_ATTEMPT = 'last_trade_ping_attempt',
    PRICE_CACHE = 'price_cache', // Stores market hash name -> price mapping (~0.86MB)
}

export type DynamicStorageKey = string;

/**
 * Encapsulates a key/value pair, each key has a value associated
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface StorageRow<T> {
    key: StorageKey | DynamicStorageKey;
}

function newRow<T>(name: StorageKey): StorageRow<T> {
    return {key: name} as StorageRow<T>;
}

/**
 * Allows defining a "dynamic" row that has different keys at runtime, but share a similar
 * type.
 *
 * NOTE: This is generally **discouraged** and you should instead store under a static key with
 * an object of your desire. It exists to be compatible with historical poor decisions.
 *
 * @param suffix Storage key used as a suffix for the internal storage key
 */
function newDynamicRow<T>(suffix: StorageKey): (prefix: string) => StorageRow<T> {
    return function (prefix: string) {
        return {key: `${prefix}_${suffix}`} as StorageRow<T>;
    };
}

// Explicitly create each row here that is used in the application
// This is designed to have type safety for all operations on the same key
export const PAGE_SIZE = newRow<number>(StorageKey.PAGE_SIZE);
// Dynamic prefixes should be the market hash name of the item
export const DYNAMIC_ITEM_FILTERS = newDynamicRow<SerializedFilter[]>(StorageKey.ITEM_FILTERS);
export const GLOBAL_FILTERS = newRow<SerializedFilter[]>(StorageKey.GLOBAL_FILTERS);
export const PRICE_CACHE = newRow<{timestamp: number; prices: Record<string, number>}>(StorageKey.PRICE_CACHE);
