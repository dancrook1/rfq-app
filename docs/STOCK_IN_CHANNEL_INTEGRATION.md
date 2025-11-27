# Stock in the Channel Integration Plan

## Overview
Integrate automatic price scraping from [Stock in the Channel](https://stockinthechannel.co.uk/) to fetch best available prices for products by SKU/MPN and use them as reference prices in the RFQ system.

## Objectives
1. Automatically fetch best prices from Stock in the Channel when creating RFQs
2. Display reference prices alongside target prices
3. Use scraped prices to validate supplier quotes
4. Cache results to minimize API calls

## Architecture

### 1. Scraping Service (`lib/stock-in-channel.ts`)

```typescript
interface StockInChannelPrice {
  distributor: string
  price: number
  currency: string
  stockLevel: string
  sku: string
  mpn: string
}

interface StockInChannelResult {
  productName: string
  bestPrice: number
  allPrices: StockInChannelPrice[]
  searchDate: Date
}
```

**Key Functions:**
- `searchBySKU(sku: string): Promise<StockInChannelResult | null>`
- `searchByMPN(mpn: string): Promise<StockInChannelResult | null>`
- `getBestPrice(sku: string, mpn: string): Promise<number | null>`

### 2. Implementation Approach

#### Option A: Web Scraping (Puppeteer/Playwright)
- **Pros**: No API key needed, full access to site
- **Cons**: More fragile, slower, requires headless browser
- **Tools**: Puppeteer or Playwright
- **Rate Limiting**: Implement delays between requests (2-3 seconds)

#### Option B: API Integration (if available)
- **Pros**: More reliable, faster, official support
- **Cons**: May require API key, may have costs
- **Action**: Contact Stock in the Channel to inquire about API access

#### Option C: Hybrid Approach
- Start with scraping, migrate to API if available
- Use caching to reduce requests

### 3. Integration Points

#### A. During RFQ Creation (`app/api/rfq/create/route.ts`)
- After parsing CSV, for each item:
  - Search Stock in the Channel by SKU or MPN
  - Store best price as `referencePrice` or update `targetPrice`
  - Cache results in database

#### B. New Database Fields
```prisma
model RFQItem {
  // ... existing fields
  referencePrice Float?  // Best price from Stock in the Channel
  priceSource    String? // "stock_in_channel" or "manual"
  priceFetchedAt DateTime?
}
```

#### C. Display in Summary Page
- Show reference price column
- Compare supplier quotes against reference price
- Highlight if supplier price is better/worse than reference

### 4. Caching Strategy

**Database Cache Table:**
```prisma
model PriceCache {
  id          String   @id @default(uuid())
  sku         String?
  mpn         String?
  bestPrice   Float
  allPrices   Json     // Store all distributor prices
  fetchedAt   DateTime @default(now())
  expiresAt   DateTime // Cache for 24 hours
}
```

**Cache Logic:**
- Check cache before scraping
- If cache exists and not expired, use cached price
- If expired or missing, fetch new price and update cache

### 5. Error Handling

- **Network Errors**: Retry with exponential backoff (3 attempts)
- **No Results Found**: Return null, don't block RFQ creation
- **Rate Limiting**: Implement request queuing
- **Timeout**: Set 10-second timeout per request

### 6. Rate Limiting & Ethics

- **Respect robots.txt**: Check and follow rules
- **Request Delays**: 2-3 seconds between requests
- **User Agent**: Identify as legitimate business tool
- **Terms of Service**: Review and comply with ToS
- **Alternative**: Contact Stock in the Channel for official API access

### 7. Implementation Steps

#### Phase 1: Basic Scraping Service
1. Set up Puppeteer/Playwright
2. Create search function for Stock in the Channel
3. Parse search results page
4. Extract price information
5. Handle basic errors

#### Phase 2: Integration
1. Add `referencePrice` field to RFQItem schema
2. Integrate scraping into RFQ creation flow
3. Store results in database
4. Display reference prices in summary

#### Phase 3: Caching & Optimization
1. Create PriceCache model
2. Implement cache checking
3. Add cache expiration logic
4. Optimize scraping performance

#### Phase 4: Enhanced Features
1. Show all distributor prices (not just best)
2. Compare supplier quotes vs. reference prices
3. Auto-update target prices based on reference
4. Background job to refresh prices

### 8. Technical Considerations

#### Search Strategy
- **Primary**: Search by SKU (most reliable)
- **Fallback**: Search by MPN if SKU search fails
- **Product Name**: Use as last resort if both fail

#### Price Extraction
- Look for "Best Price" or lowest price across distributors
- Extract currency (should be GBP)
- Handle multiple price formats
- Parse stock availability

#### Website Structure Analysis Needed
- Search URL format
- Search result page structure
- Price element selectors
- Pagination handling (if multiple pages)

### 9. Alternative: Manual Import
- If scraping proves difficult, allow manual CSV import of prices
- Format: SKU, Reference Price, Source
- Import during RFQ creation

### 10. Testing Strategy

1. **Unit Tests**: Test price parsing logic
2. **Integration Tests**: Test with real SKUs
3. **Error Scenarios**: Test with invalid SKUs, network failures
4. **Performance Tests**: Measure scraping speed
5. **Cache Tests**: Verify caching works correctly

### 11. Monitoring & Logging

- Log all scraping attempts
- Track success/failure rates
- Monitor cache hit rates
- Alert on high failure rates
- Track response times

### 12. Future Enhancements

1. **Multiple Sources**: Integrate other price comparison sites
2. **Price Alerts**: Notify when prices change significantly
3. **Historical Tracking**: Store price history
4. **Automated Updates**: Background job to refresh prices daily
5. **API Integration**: Migrate to official API if available

## Dependencies

```json
{
  "puppeteer": "^21.0.0",  // or "playwright": "^1.40.0"
  "cheerio": "^1.0.0",     // For HTML parsing (if not using browser)
  "node-cache": "^5.1.2"   // For in-memory caching (optional)
}
```

## Security Considerations

1. **Input Sanitization**: Sanitize SKU/MPN before searching
2. **Rate Limiting**: Prevent abuse
3. **Error Messages**: Don't expose internal details
4. **User Permissions**: Only allow authorized users to trigger scraping

## Estimated Timeline

- **Phase 1**: 2-3 days (Basic scraping service)
- **Phase 2**: 2-3 days (Integration)
- **Phase 3**: 1-2 days (Caching)
- **Phase 4**: 2-3 days (Enhanced features)

**Total**: ~7-11 days

## Next Steps

1. **Research**: Analyze Stock in the Channel website structure
2. **Contact**: Reach out to Stock in the Channel for API access
3. **Prototype**: Build basic scraping proof-of-concept
4. **Test**: Test with real product SKUs
5. **Implement**: Integrate into RFQ creation flow

