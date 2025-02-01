import {SimpleHandler} from './main';
import {RequestType} from './types';

export interface HasPermissionsRequest {
    permissions: chrome.runtime.ManifestPermissions[];
    origins: string[];
}

export interface HasPermissionsResponse {
    granted: boolean;
}

export const HasPermissions = new SimpleHandler<HasPermissionsRequest, HasPermissionsResponse>(
    RequestType.HAS_PERMISSIONS,
    async (req) => {
        const granted = await chrome.permissions.contains({
            permissions: req.permissions,
            origins: req.origins,
        });

        return {
            granted,
        };
    }
);
