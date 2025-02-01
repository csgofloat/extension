import {FloatElement} from '../custom';
import {CustomElement} from '../injectors';
import {html, css, HTMLTemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ItemInfo} from '../../bridge/handlers/fetch_inspect_info';
import {InventoryAsset} from '../../types/steam';
import {environment} from '../../../environment';
import {ClientSend} from '../../bridge/client';
import {ListItem} from '../../bridge/handlers/list_item';
import {FetchRecommendedPrice} from '../../bridge/handlers/fetch_recommended_price';

@CustomElement()
export class ListItemModal extends FloatElement {
    @property()
    itemInfo!: ItemInfo;

    @property()
    asset!: InventoryAsset;

    @state()
    private recommendedPrice: number | undefined;

    @state()
    private listingType: 'buy_now' | 'auction' = 'buy_now';

    @state()
    private customPrice: number | undefined;

    @state()
    private pricePercentage: number = 100;

    @state()
    private maxOfferDiscount: number = 0;

    @state()
    private auctionDuration: 1 | 3 | 5 | 7 | 14 = 7;

    @state()
    private isLoading: boolean = false;

    @state()
    private error: string | undefined;

    static styles = [
        ...FloatElement.styles,
        css`
            .modal-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .modal-content {
                background: #1b2838;
                padding: 20px;
                border-radius: 4px;
                width: 500px;
                max-width: 90%;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .modal-title {
                font-size: 18px;
                color: #ffffff;
            }

            .close-button {
                background: none;
                border: none;
                color: #ffffff;
                font-size: 20px;
                cursor: pointer;
            }

            .price-section {
                margin-bottom: 20px;
            }

            .price-input {
                width: 100%;
                padding: 8px;
                margin-top: 5px;
                background: #2a475e;
                border: 1px solid #000000;
                color: #ffffff;
            }

            .percentage-slider {
                width: 100%;
                margin-top: 10px;
            }

            .error-message {
                color: #ff4444;
                margin-top: 10px;
            }

            .submit-button {
                width: 100%;
                padding: 10px;
                background: #66c0f4;
                border: none;
                border-radius: 4px;
                color: #ffffff;
                font-size: 16px;
                cursor: pointer;
                margin-top: 10px;
            }

            .submit-button:disabled {
                background: #2a475e;
                cursor: not-allowed;
            }

            .listing-type-selector {
                margin-bottom: 20px;
                display: flex;
                gap: 10px;
            }

            .type-button {
                flex: 1;
                padding: 10px;
                background: #2a475e;
                border: 1px solid #000000;
                color: #ffffff;
                cursor: pointer;
            }

            .type-button.active {
                background: #66c0f4;
            }

            .auction-settings {
                margin-top: 10px;
            }

            .duration-select {
                width: 100%;
                padding: 8px;
                margin-top: 5px;
                background: #2a475e;
                border: 1px solid #000000;
                color: #ffffff;
            }

            .description-input {
                width: 100%;
                padding: 8px;
                margin-top: 5px;
                background: #2a475e;
                border: 1px solid #000000;
                color: #ffffff;
                resize: vertical;
                min-height: 60px;
            }

            .checkbox-container {
                margin-top: 10px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
        `,
    ];

    async connectedCallback() {
        super.connectedCallback();
        await this.fetchRecommendedPrice();
    }

    async fetchRecommendedPrice() {
        try {
            this.isLoading = true;

            const response = await ClientSend(FetchRecommendedPrice, {
                market_hash_name: this.asset.description.market_hash_name,
            });

            this.recommendedPrice = response.price;
            this.customPrice = this.recommendedPrice;
        } catch (error: unknown) {
            this.error = error instanceof Error ? error.message : 'Failed to fetch recommended price';
        } finally {
            this.isLoading = false;
        }
    }

    private handlePriceChange(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        this.customPrice = Math.round(Number(parseFloat(value)) * 100);
        if (this.recommendedPrice) {
            this.pricePercentage = Number(((this.customPrice / this.recommendedPrice) * 100).toFixed(1));
        }
    }

    private handlePercentageChange(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        this.pricePercentage = Number(parseFloat(value).toFixed(1));
        if (this.recommendedPrice) {
            this.customPrice = Math.round((this.pricePercentage / 100) * this.recommendedPrice);
        }
    }

    private async handleSubmit() {
        if (!this.customPrice) return;

        try {
            this.isLoading = true;

            const request =
                this.listingType === 'buy_now'
                    ? {
                          type: 'buy_now' as const,
                          asset_id: this.asset.assetid,
                          price: this.customPrice,
                      }
                    : {
                          type: 'auction' as const,
                          asset_id: this.asset.assetid,
                          reserve_price: this.customPrice,
                          duration_days: this.auctionDuration,
                      };

            const response = await ClientSend(ListItem, request);

            if (!response.success) {
                throw new Error(response.error || 'Failed to list item');
            }

            this.dispatchEvent(new CustomEvent('close'));
            window.location.reload(); // Refresh to show updated listing status
        } catch (error) {
            this.error =
                error instanceof Error ? error.message : 'Failed to list item. Make sure you are logged into CSFloat.';
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    render(): HTMLTemplateResult {
        return html`
            <div
                class="modal-backdrop"
                @click="${(e: Event) => {
                    if (e.target === e.currentTarget) this.dispatchEvent(new CustomEvent('close'));
                }}"
            >
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">List Item on CSFloat</h2>
                        <button class="close-button" @click="${() => this.dispatchEvent(new CustomEvent('close'))}">
                            ×
                        </button>
                    </div>

                    <div class="listing-type-selector">
                        <button
                            class="type-button ${this.listingType === 'buy_now' ? 'active' : ''}"
                            @click="${() => (this.listingType = 'buy_now')}"
                        >
                            Buy Now
                        </button>
                        <button
                            class="type-button ${this.listingType === 'auction' ? 'active' : ''}"
                            @click="${() => (this.listingType = 'auction')}"
                        >
                            Auction
                        </button>
                    </div>

                    <div class="price-section">
                        <label>
                            Recommended Price:
                            ${this.isLoading
                                ? 'Loading...'
                                : this.recommendedPrice
                                ? `$${(this.recommendedPrice / 100).toFixed(2)}`
                                : 'N/A'}
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            class="price-input"
                            .value="${this.customPrice ? (this.customPrice / 100).toFixed(2) : ''}"
                            @input="${this.handlePriceChange}"
                            placeholder="${this.listingType === 'buy_now'
                                ? 'Enter listing price in USD'
                                : 'Enter starting price in USD'}"
                        />
                        <input
                            type="range"
                            min="1"
                            max="200"
                            .value="${this.pricePercentage}"
                            @input="${this.handlePercentageChange}"
                            class="percentage-slider"
                        />
                        <div>Percentage of recommended price: ${this.pricePercentage.toFixed(1)}%</div>

                        ${this.listingType === 'auction'
                            ? html`
                                  <div class="auction-settings">
                                      <label>Auction Duration</label>
                                      <select
                                          class="duration-select"
                                          .value="${this.auctionDuration}"
                                          @change="${(e: Event) =>
                                              (this.auctionDuration = Number((e.target as HTMLSelectElement).value) as
                                                  | 1
                                                  | 3
                                                  | 5
                                                  | 7
                                                  | 14)}"
                                      >
                                          <option value="1">1 Day</option>
                                          <option value="3">3 Days</option>
                                          <option value="5">5 Days</option>
                                          <option value="7">7 Days</option>
                                          <option value="14">14 Days</option>
                                      </select>
                                  </div>
                              `
                            : ''}
                    </div>

                    ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}

                    <button
                        class="submit-button"
                        ?disabled="${this.isLoading || !this.customPrice}"
                        @click="${this.handleSubmit}"
                    >
                        ${this.isLoading
                            ? 'Listing...'
                            : this.listingType === 'buy_now'
                            ? 'List for Sale'
                            : 'Start Auction'}
                    </button>
                </div>
            </div>
        `;
    }
}
