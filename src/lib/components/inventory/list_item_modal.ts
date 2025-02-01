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
    private customPrice: number | undefined;

    @state()
    private pricePercentage: number = 100;

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
            }

            .submit-button:disabled {
                background: #2a475e;
                cursor: not-allowed;
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
            const response = await ClientSend(ListItem, {
                asset_id: this.asset.assetid,
                price: this.customPrice,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to list item');
            }

            this.dispatchEvent(new CustomEvent('close'));
            window.location.reload(); // Refresh to show updated listing status
        } catch (error) {
            this.error = 'Failed to list item. Make sure you are logged into CSFloat.';
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
                            placeholder="Enter price in USD"
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
                    </div>

                    ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}

                    <button
                        class="submit-button"
                        ?disabled="${this.isLoading || !this.customPrice}"
                        @click="${this.handleSubmit}"
                    >
                        ${this.isLoading ? 'Listing...' : 'List Item'}
                    </button>
                </div>
            </div>
        `;
    }
}
