import {SimpleHandler} from './main';
import {RequestType} from './types';

export interface CreateTradeOfferRequest {
    toSteamID64: string;
    tradeToken: string;
    message: string;
    assetIDsToGive: string[];
    assetIDsToReceive: string[];
    sessionID: string;
}

export interface CreateTradeOfferResponse {}

export const CreateTradeOffer = new SimpleHandler<CreateTradeOfferRequest, CreateTradeOfferResponse>(
    RequestType.CREATE_TRADE_OFFER,
    async (req) => {
        function itemMapper(assetID: string) {
            return {
                appid: 730,
                contextid: 2,
                amount: 1,
                assetid: assetID,
            };
        }

        const offerData = {
            newversion: true,
            version: req.assetIDsToGive.length + req.assetIDsToReceive.length + 1,
            me: {
                assets: req.assetIDsToGive.map(itemMapper),
                currency: [],
                ready: false,
            },
            them: {
                assets: req.assetIDsToReceive.map(itemMapper),
                currency: [],
                ready: false,
            },
        };

        const params = {
            trade_offer_access_token: req.tradeToken,
        };

        const formData = {
            sessionid: req.sessionID,
            serverid: 1,
            partner: req.toSteamID64,
            tradeoffermessage: req.message || 'CSFloat Trade Offer',
            json_tradeoffer: JSON.stringify(offerData),
            captcha: '',
            trade_offer_create_params: JSON.stringify(params),
        };

        await fetch('https://steamcommunity.com/tradeoffer/new/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                // Referer is actually set in the declarative net static rules since
                // it is a "protected" header. Setting it here does nothing in major browsers.
                // Without it, Steam rejects the request as part of their anti-cross origin block.
            },
            body: new URLSearchParams(formData as any).toString(),
        });

        return {};
    }
);
