import {InternalRequestBundle, InternalResponseBundle, RequestHandler, Version} from './types';
import {isFirefox, runtimeNamespace} from '../utils/detect';
import {inPageContext} from '../utils/snips';
import {g_PostMessageBus} from '../bus/post_message_bus';
import {DeferredPromise} from '../utils/deferred_promise';

function canUseSendMessage() {
    // Not supported in Firefox Page Context
    return !(isFirefox() && inPageContext());
}

/**
 * Send a request to be handled by the background worker
 *
 * Can be called from a content script or page itself
 */
export async function ClientSend<Req, Resp>(handler: RequestHandler<Req, Resp>, args: Req): Promise<Resp> {
    const bundle: InternalRequestBundle = {
        version: Version.V1,
        request_type: handler.getType(),
        request: args,
        id: Math.ceil(Math.random() * 100000000000),
    };

    if (canUseSendMessage()) {
        const promise = new DeferredPromise<Resp>();

        // @ts-ignore Bad types
        runtimeNamespace().runtime.sendMessage(
            (typeof window !== 'undefined' && window.CSFLOAT_EXTENSION_ID) || chrome.runtime.id,
            bundle,
            // @ts-ignore Bad types
            (resp: InternalResponseBundle) => {
                if (resp?.response) {
                    promise.resolve(resp.response);
                } else {
                    promise.reject(resp?.error);
                }
            }
        );

        return promise.promise();
    } else {
        // Fallback to postmessage bus for browsers that don't implement
        // specs fully
        return g_PostMessageBus.sendRequest(bundle);
    }
}
