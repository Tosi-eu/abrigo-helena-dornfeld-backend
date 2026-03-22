export interface PriceSearchResult {
  averagePrice: number | null;
  source: string;
  lastUpdated: Date;
}

export interface IPriceSearchService {
  searchPrice(
    itemName: string,
    itemType: 'medicine' | 'input',
    dosage?: string,
    measurementUnit?: string,
  ): Promise<PriceSearchResult | null>;
}
