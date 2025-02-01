import {FloatElement} from '../custom';
import {CustomElement, InjectAfter, InjectionMode} from '../injectors';
import {html, css, TemplateResult, HTMLTemplateResult} from 'lit';
import {state} from 'lit/decorators.js';
import {InventoryAsset} from '../../types/steam';
import {gFloatFetcher} from '../../services/float_fetcher';
import {ItemInfo} from '../../bridge/handlers/fetch_inspect_info';
import {
    formatSeed,
    getFadePercentage,
    isSkin,
    renderClickableRank,
    floor,
    isCharm,
    isSellableOnCSFloat,
} from '../../utils/skin';
import {Observe} from '../../utils/observers';
import {FetchStallResponse} from '../../bridge/handlers/fetch_stall';
import {gStallFetcher} from '../../services/stall_fetcher';
import {Contract} from '../../types/float_market';
import '../common/ui/floatbar';
import './list_item_modal';

/**
 * Why do we bind to iteminfo0 AND iteminfo1?
 *
 * Steam uses two divs that are interchanged (presumably to make a "fade" animation between them) for each selected
 * item click.
 */
@CustomElement()
@InjectAfter('div#iteminfo0_content .item_desc_description div.item_desc_game_info', InjectionMode.CONTINUOUS)
@InjectAfter('div#iteminfo1_content .item_desc_description div.item_desc_game_info', InjectionMode.CONTINUOUS)
export class SelectedItemInfo extends FloatElement {
    static styles = [
        ...FloatElement.styles,
        css`
            .container {
                margin-bottom: 10px;
            }

            .market-btn-container {
                margin: 10px 0 10px 0;
                padding: 5px;
                width: fit-content;
                border: 1px #5a5a5a solid;
                background-color: #383838;
                border-radius: 3px;
            }

            .market-btn {
                font-size: 15px;
                display: flex;
                align-items: center;
                color: #ebebeb;
                text-decoration: none;
            }
        `,
    ];

    @state()
    private itemInfo: ItemInfo | undefined;

    @state()
    private loading: boolean = false;

    private stall: FetchStallResponse | undefined;

    @state()
    private showListModal: boolean = false;

    get asset(): InventoryAsset | undefined {
        return g_ActiveInventory?.selectedItem;
    }

    get inspectLink(): string | undefined {
        if (!this.asset) return;

        if (!this.asset.description?.actions || this.asset.description?.actions?.length === 0) return;

        if (!g_ActiveInventory?.m_owner) {
            return;
        }

        return this.asset.description
            ?.actions![0].link.replace('%owner_steamid%', g_ActiveInventory.m_owner.strSteamId!)
            .replace('%assetid%', this.asset.assetid!);
    }

    get stallListing(): Contract | undefined {
        if (!this.stall) {
            return;
        }

        return (this.stall.data || []).find((e) => e.item.asset_id === this.asset?.assetid);
    }

    protected render(): HTMLTemplateResult {
        if (this.loading) {
            return html`<div>Loading...</div>`;
        }

        if (!this.asset?.description) {
            return html``;
        }

        const containerChildren: TemplateResult[] = [];

        if (isSkin(this.asset.description) && this.itemInfo) {
            containerChildren.push(this.renderFloatBar());
            containerChildren.push(
                html`<div>Float: ${this.itemInfo.floatvalue.toFixed(14)} ${renderClickableRank(this.itemInfo)}</div>`
            );

            containerChildren.push(html`<div>Paint Seed: ${formatSeed(this.itemInfo)}</div>`);

            const fadePercentage = getFadePercentage(this.asset.description, this.itemInfo);
            if (fadePercentage !== undefined) {
                containerChildren.push(html`<div>Fade: ${floor(fadePercentage, 5)}%</div>`);
            }
        } else if (isCharm(this.asset.description) && this.itemInfo) {
            containerChildren.push(
                html`<div>
                    Pattern: #${this.itemInfo.keychains?.length > 0 ? this.itemInfo.keychains[0].pattern : 'Unknown'}
                </div>`
            );
        }

        if (isSellableOnCSFloat(this.asset.description)) {
            containerChildren.push(html`${this.renderListOnCSFloat()} ${this.renderFloatMarketListing()}`);
        }

        if (containerChildren.length === 0) {
            return html``;
        }

        return html` <div class="container">${containerChildren}</div> `;
    }

    renderFloatBar(): TemplateResult<1> {
        if (!this.itemInfo || !this.itemInfo.floatvalue) {
            return html``;
        }

        return html`
            <csfloat-float-bar
                float=${this.itemInfo.floatvalue}
                minFloat=${this.itemInfo.min}
                maxFloat=${this.itemInfo.max}
            >
            </csfloat-float-bar>
        `;
    }

    renderFloatMarketListing(): TemplateResult<1> {
        if (!this.stallListing) {
            return html``;
        }

        return html`
            <div class="market-btn-container">
                <a class="market-btn" href="https://csfloat.com/item/${this.stallListing.id}" target="_blank">
                    <img src="https://csfloat.com/assets/n_full_logo.png" height="21" style="margin-right: 5px;" />
                    <span>
                        Listed for
                        <b>$${(this.stallListing.price / 100).toFixed(2)}</b>
                    </span>
                </a>
            </div>
        `;
    }

    renderListOnCSFloat(): TemplateResult<1> {
        if (this.stallListing) {
            // Don't tell them to list it if it's already listed...
            return html``;
        }

        if (g_ActiveInventory?.m_owner?.strSteamId !== g_steamID) {
            // Not the signed-in user, don't show
            return html``;
        }

        return html`
            <div class="market-btn-container">
                <a class="market-btn" @click="${() => (this.showListModal = true)}">
                    <span>List on </span>
                    <img src="https://csfloat.com/assets/n_full_logo.png" height="21" style="margin-left: 5px;" />
                </a>
            </div>
            ${this.showListModal && this.asset && this.itemInfo
                ? html`<csfloat-list-item-modal
                      .asset="${this.asset}"
                      .itemInfo="${this.itemInfo}"
                      @close="${() => (this.showListModal = false)}"
                  ></csfloat-list-item-modal>`
                : ''}
        `;
    }

    async processSelectChange() {
        // Reset state in-case they swap between skin and non-skin
        this.itemInfo = undefined;

        if (!this.asset) return;

        // Guarantees a re-render for items without inspect links
        this.loading = true;

        if (this.inspectLink && (isSkin(this.asset.description) || isCharm(this.asset.description))) {
            try {
                this.itemInfo = await gFloatFetcher.fetch({
                    link: this.inspectLink,
                });
            } catch (e: any) {
                console.error(`Failed to fetch float for ${this.asset.assetid}: ${e.toString()}`);
            }
        }
        this.loading = false;
    }

    connectedCallback() {
        super.connectedCallback();

        // For the initial load, in case an item is pre-selected
        this.processSelectChange();

        Observe(
            () => this.asset,
            () => {
                this.processSelectChange();
            }
        );

        if (g_ActiveInventory?.m_owner?.strSteamId) {
            // Ignore errors
            gStallFetcher
                .fetch({steam_id64: g_ActiveInventory?.m_owner.strSteamId})
                .then((stall) => (this.stall = stall));
        }

        // Make sure the parent container can overflow
        const parentContainer = this.closest<HTMLElement>('.item_desc_content');
        if (parentContainer) {
            parentContainer.style.overflow = 'visible';
        }
    }
}
