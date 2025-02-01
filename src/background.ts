import {Handle} from './lib/bridge/server';
import {InternalResponseBundle} from './lib/bridge/types';
import MessageSender = chrome.runtime.MessageSender;
import {alarmListener, registerTradeAlarmIfPossible} from './lib/alarms/setup';
import {pingTradeStatus} from './lib/alarms/csfloat_trade_pings';
import {gStore} from './lib/storage/store';
import {StorageKey} from './lib/storage/keys';
import {isFirefox} from './lib/utils/detect';

function unifiedHandler(request: any, sender: MessageSender, sendResponse: (response?: any) => void) {
    Handle(request, sender)
        .then((response) => {
            sendResponse({
                request_type: request.request_type,
                id: request.id,
                response,
            } as InternalResponseBundle);
        })
        .catch((error) => {
            sendResponse({
                request_type: request.request_type,
                id: request.id,
                error: error.toString(),
            } as InternalResponseBundle);
        });
}

function requestPermissions(permissions: chrome.runtime.ManifestPermissions[], origins: string[], sendResponse: any) {
    chrome.permissions.request({permissions, origins}, (granted) => sendResponse(granted));

    return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'requestPermissions') {
        return requestPermissions(request.permissions, request.origins, sendResponse);
    }

    unifiedHandler(request, sender, sendResponse);
    return true;
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    unifiedHandler(request, sender, sendResponse);
    return true;
});

if (chrome.alarms) {
    // Install at the root level to make sure events wake up the service worker
    chrome.alarms.onAlarm.addListener(alarmListener);
}

async function checkAlarmState() {
    await registerTradeAlarmIfPossible();
}

checkAlarmState();

// Ping trade status upon service worker wake-up
// Why do this even though there's an alarm? Well, some people turn on their device briefly to send a trade offer
// then close it quickly, it's hard to rely on Chrome's scheduling in that case
async function checkTradeStatus() {
    const lastPing = await gStore.getWithStorage<number>(chrome.storage.local, StorageKey.LAST_TRADE_PING_ATTEMPT);
    if (!lastPing || lastPing < Date.now() - 3 * 60 * 1000) {
        // Last ping was over 3 minutes ago
        pingTradeStatus();
    }
}
checkTradeStatus();

if (isFirefox()) {
    // Need to manually update the rule to allow the extension to send trade offers
    // Since Firefox IDs are random and we still want to scope it to only this extension
    browser.declarativeNetRequest
        .updateDynamicRules({
            removeRuleIds: [1738196326],
            addRules: [
                {
                    id: 1738196326,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            {
                                header: 'referer',
                                operation: 'set',
                                value: 'https://steamcommunity.com/tradeoffer/new',
                            },
                        ],
                    },
                    condition: {
                        urlFilter: 'https://steamcommunity.com/tradeoffer/new/send',
                        resourceTypes: ['xmlhttprequest'],
                        initiatorDomains: [new URL(browser.runtime.getURL('')).hostname],
                    },
                },
            ],
        })
        .then(() => {
            console.log('[INFO] Successfully updated ruleset');
        })
        .catch((e) => {
            console.error('[ERROR] Failed to update ruleset for Firefox');
        });
}
