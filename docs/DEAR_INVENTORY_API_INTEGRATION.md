# Dear Inventory (Cin7) API Integration Plan

## Overview
Replace CSV file uploads with direct API integration to Dear Inventory (Cin7) to automatically fetch product data, stock levels, pricing, and availability information when creating RFQs.

## Objectives
1. Eliminate manual CSV exports and uploads
2. Real-time data synchronization with Dear Inventory
3. Automatic product information retrieval (SKU, name, MPN, category, pricing)
4. Real-time stock availability and on-order quantities
5. **Automatic supplier synchronization from Dear Inventory**
6. Maintain data accuracy and reduce manual errors

## Dear Inventory API Reference
API Documentation: https://dearinventory.docs.apiary.io/#

### Key Endpoints (Based on Standard Inventory APIs)

#### Authentication
- **Method**: API Key or OAuth
- **Header**: `api-auth-accountid` and `api-auth-applicationkey`
- **Base URL**: `https://inventory.dearsystems.com/ExternalApi/v2/`

#### Relevant Endpoints

1. **Products/Inventory**
   - `GET /products` - List all products
   - `GET /products/{id}` - Get specific product details
   - `GET /products?sku={sku}` - Search by SKU
   - `GET /inventory` - Get stock levels

2. **Stock Availability**
   - `GET /inventory/availability` - Get stock availability
   - `GET /inventory/on-hand` - Get on-hand quantities
   - `GET /inventory/on-order` - Get on-order quantities

3. **Pricing**
   - `GET /products/{id}/pricing` - Get product pricing tiers
   - `GET /price-lists` - Get price list information

4. **Suppliers**
   - `GET /suppliers` - List all suppliers
   - `GET /suppliers/{id}` - Get specific supplier details
   - `GET /suppliers?name={name}` - Search suppliers by name

## Architecture

### 1. API Service Layer (`lib/dear-inventory.ts`)

```typescript
interface DearInventoryConfig {
  accountId: string
  applicationKey: string
  baseUrl?: string
}

interface DearProduct {
  ID: string
  SKU: string
  Name: string
  Category?: string
  Barcode?: string
  PriceTier1?: number
  PriceTier2?: number
  PriceTier3?: number
  // Additional fields from API
}

interface DearInventoryLevel {
  SKU: string
  OnHand: number
  Available: number
  OnOrder: number
  Allocated: number
}

interface DearProductWithInventory extends DearProduct {
  inventory: DearInventoryLevel
}

interface DearSupplier {
  ID: string
  Name: string
  Email?: string
  Contact?: string
  Phone?: string
  Address?: string
  IsActive?: boolean
  // Additional fields from API
}

class DearInventoryClient {
  private config: DearInventoryConfig
  
  constructor(config: DearInventoryConfig) {
    this.config = config
  }

  // Fetch products that need restocking (Available < 0)
  async getProductsNeedingStock(): Promise<DearProductWithInventory[]>
  
  // Get product by SKU
  async getProductBySKU(sku: string): Promise<DearProduct | null>
  
  // Get inventory levels for a product
  async getInventoryLevel(sku: string): Promise<DearInventoryLevel | null>
  
  // Get all products with inventory data
  async getAllProductsWithInventory(): Promise<DearProductWithInventory[]>
  
  // Extract MPN from product (from SKU or custom field)
  extractMPN(product: DearProduct): string

  // Supplier methods
  async getAllSuppliers(): Promise<DearSupplier[]>
  async getSupplierById(id: string): Promise<DearSupplier | null>
  async getActiveSuppliers(): Promise<DearSupplier[]>
}
```

### 2. Configuration Management

#### Environment Variables
```env
DEAR_INVENTORY_ACCOUNT_ID=your_account_id
DEAR_INVENTORY_APPLICATION_KEY=your_application_key
DEAR_INVENTORY_BASE_URL=https://inventory.dearsystems.com/ExternalApi/v2
```

#### Settings Page Enhancement
- Add Dear Inventory API configuration section
- Store credentials securely (encrypted in database)
- Test connection button
- Display connection status

### 3. Database Schema Updates

```prisma
model DearInventoryConfig {
  id            String   @id @default(uuid())
  accountId     String
  applicationKey String  // Encrypted
  baseUrl       String   @default("https://inventory.dearsystems.com/ExternalApi/v2")
  isActive      Boolean  @default(true)
  lastSync      DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model RFQItem {
  // ... existing fields
  dearProductId String?  // Link to Dear Inventory product
  lastSyncedAt  DateTime? // When last synced from Dear
}

model GlobalSupplier {
  // ... existing fields
  dearSupplierId String?  // Link to Dear Inventory supplier
  syncedFromDear Boolean  @default(false) // Whether synced from Dear
  lastSyncedAt   DateTime? // When last synced from Dear
}
```

### 4. Supplier Synchronization

#### A. Settings Page Integration (`app/settings/page.tsx`)

**New Features:**
- "Sync Suppliers from Dear Inventory" button
- Display sync status and last sync time
- Show which suppliers came from Dear Inventory
- Option to sync automatically or manually
- Merge strategy: Replace, Merge, or Supplement

**UI Updates:**
- Add sync button in Settings page
- Show supplier source (Manual vs Dear Inventory)
- Display sync status indicator
- Allow selective sync (choose which suppliers to import)

#### B. Supplier Sync API Route (`app/api/settings/suppliers/sync/route.ts`)

```typescript
export async function POST(request: NextRequest) {
  // 1. Get Dear Inventory config
  // 2. Fetch all suppliers from Dear Inventory
  // 3. Map to GlobalSupplier format
  // 4. Handle merge strategy:
  //    - Replace: Delete all, import from Dear
  //    - Merge: Add new, update existing, keep manual
  //    - Supplement: Only add new suppliers
  // 5. Return sync results (added, updated, skipped)
}
```

#### C. Supplier Mapping

**Dear Inventory → GlobalSupplier Mapping:**

| Dear Inventory Field | GlobalSupplier Field | Notes |
|---------------------|---------------------|-------|
| `Name` | `name` | Direct mapping |
| `Email` or `Contact` | `email` | Use Email if available, else Contact |
| `ID` | `dearSupplierId` | Store for future syncs |
| `IsActive` | Filter | Only sync active suppliers |

**Matching Logic:**
- Match by `dearSupplierId` if exists
- Fallback: Match by name (case-insensitive)
- If no match: Create new supplier

#### D. Sync Strategies

**Option 1: Replace All**
- Delete all existing suppliers
- Import all from Dear Inventory
- Simple but loses manual additions
- **Use Case**: Starting fresh or complete reset

**Option 2: Merge (Recommended)**
- Keep manually added suppliers (not synced from Dear)
- Update suppliers that exist in both (match by `dearSupplierId` or name)
- Add new suppliers from Dear Inventory
- Mark suppliers synced from Dear with `syncedFromDear: true`
- **Use Case**: Ongoing operations, want to keep manual additions

**Option 3: Supplement Only**
- Only add suppliers that don't exist
- Never update or delete existing
- Safest option, preserves all manual changes
- **Use Case**: Conservative approach, testing phase

#### E. Supplier Sync Implementation

**API Route: `/api/settings/suppliers/sync`**

```typescript
interface SyncOptions {
  strategy: 'replace' | 'merge' | 'supplement'
  onlyActive?: boolean  // Only sync active suppliers
}

interface SyncResult {
  added: number
  updated: number
  skipped: number
  errors: string[]
  lastSyncedAt: Date
}
```

**Sync Process:**
1. Fetch Dear Inventory config
2. Call Dear Inventory API to get suppliers
3. Filter active suppliers if `onlyActive: true`
4. Apply selected sync strategy
5. Update `lastSyncedAt` timestamp
6. Return sync results

**Matching Logic:**
```typescript
// Priority 1: Match by dearSupplierId
const existing = globalSuppliers.find(s => s.dearSupplierId === dearSupplier.ID)

// Priority 2: Match by name (case-insensitive)
if (!existing) {
  existing = globalSuppliers.find(s => 
    s.name.toLowerCase() === dearSupplier.Name.toLowerCase()
  )
}

// If no match: Create new supplier
// If match found: Update based on strategy
```

### 5. Integration Points

#### A. RFQ Creation Flow (`app/rfq/create/page.tsx`)

**Current Flow:**
1. User uploads CSV
2. Parse CSV
3. Create RFQ

**New Flow:**
1. User clicks "Create RFQ from Dear Inventory"
2. Fetch products needing stock from API
3. Display preview of items
4. User confirms and creates RFQ

**UI Changes:**
- Replace CSV upload with "Sync from Dear Inventory" button
- Show loading state while fetching
- Display preview table before creation
- Allow filtering/selection of items
- Show sync status and last sync time

#### B. API Route Updates (`app/api/rfq/create/route.ts`)

```typescript
// New endpoint: /api/rfq/create-from-dear
export async function POST(request: NextRequest) {
  // 1. Get Dear Inventory config
  // 2. Initialize Dear Inventory client
  // 3. Fetch products needing stock
  // 4. Filter out SYS_ and MPC_ SKUs
  // 5. Calculate target prices (PriceTier1 / 1.2)
  // 6. Create RFQ with items
  // 7. Return RFQ ID
}
```

### 6. Data Mapping

#### CSV to API Mapping

| CSV Field | Dear Inventory API Field | Notes |
|-----------|-------------------------|-------|
| SKU | `SKU` | Direct mapping |
| ProductName | `Name` | Direct mapping |
| Category | `Category` or custom field | May need mapping |
| PriceTier1 | `PriceTier1` | Sales price |
| Available | `Available` | Stock available (negative = needed) |
| OnHand | `OnHand` | Physical stock |
| OnOrder | `OnOrder` | On order quantity |
| MPN | Extracted from SKU or `Barcode`/custom field | Use existing extraction logic |

### 7. Error Handling

- **API Authentication Errors**: Clear error messages, link to settings
- **Rate Limiting**: Implement exponential backoff, queue requests
- **Network Errors**: Retry logic (3 attempts)
- **Missing Data**: Handle null/undefined fields gracefully
- **API Changes**: Version API calls, handle deprecated endpoints

### 8. Caching Strategy

**Cache Dear Inventory Data:**
- Cache product list for 5-10 minutes
- Cache inventory levels for 2-5 minutes
- Store last sync timestamp
- Invalidate cache on manual refresh

**Implementation:**
```typescript
// Use Next.js cache or Redis
const cacheKey = `dear-inventory-products-${accountId}`
const cached = await cache.get(cacheKey)
if (cached && !expired) return cached
```

### 9. Rate Limiting & Performance

- **API Rate Limits**: Check Dear Inventory documentation for limits
- **Batch Requests**: Fetch multiple products in single request if supported
- **Pagination**: Handle large product catalogs
- **Background Sync**: Option to sync in background for large catalogs
- **Progress Indicators**: Show sync progress for large datasets

### 10. Migration Strategy

#### Phase 1: Dual Mode (CSV + API)
- Keep CSV upload option
- Add "Sync from Dear Inventory" option
- Allow users to choose method
- Test API integration thoroughly

#### Phase 2: API Primary
- Make API the default method
- Keep CSV as fallback option
- Add migration tool for existing RFQs

#### Phase 3: API Only
- Remove CSV upload
- Full API integration
- Real-time sync capabilities

### 11. Implementation Steps

#### Step 1: API Client Setup
1. Create `lib/dear-inventory.ts` service
2. Implement authentication
3. Create basic product fetch function
4. **Add supplier fetch functions**
5. Add error handling

#### Step 2: Configuration
1. Add environment variables
2. Create settings page for API credentials
3. Add configuration model to database
4. Implement credential encryption

#### Step 3: Supplier Sync
1. **Add supplier sync API route**
2. **Update Settings page with sync button**
3. **Implement merge/sync logic**
4. **Add supplier source tracking**

#### Step 4: RFQ Creation Integration
1. Update RFQ create page UI
2. Add "Sync from Dear" button
3. Create preview component
4. Update API route to handle API data

#### Step 5: Data Processing
1. Map Dear Inventory data to RFQ format
2. Apply filters (SYS_, MPC_, negative Available)
3. Calculate target prices
4. Extract MPN from SKU

#### Step 6: Testing & Refinement
1. Test with real Dear Inventory account
2. Handle edge cases
3. Optimize performance
4. Add error recovery

#### Step 1: API Client Setup
1. Create `lib/dear-inventory.ts` service
2. Implement authentication
3. Create basic product fetch function
4. Add error handling

#### Step 2: Configuration
1. Add environment variables
2. Create settings page for API credentials
3. Add configuration model to database
4. Implement credential encryption

#### Step 3: RFQ Creation Integration
1. Update RFQ create page UI
2. Add "Sync from Dear" button
3. Create preview component
4. Update API route to handle API data

#### Step 4: Data Processing
1. Map Dear Inventory data to RFQ format
2. Apply filters (SYS_, MPC_, negative Available)
3. Calculate target prices
4. Extract MPN from SKU

#### Step 5: Testing & Refinement
1. Test with real Dear Inventory account
2. Handle edge cases
3. Optimize performance
4. Add error recovery

### 12. Security Considerations

- **API Keys**: Store encrypted in database
- **Environment Variables**: Never commit to git
- **HTTPS Only**: All API calls over HTTPS
- **Access Control**: Only authorized users can configure API
- **Audit Logging**: Log all API calls for debugging

### 13. User Experience Improvements

- **Automatic Supplier Management**: No manual entry needed
- **Always Up-to-date**: Suppliers stay in sync with Dear Inventory
- **Source Tracking**: Know which suppliers came from Dear vs manual
- **Flexible Sync**: Choose when and how to sync

- **Real-time Sync**: No manual export/import needed
- **Always Up-to-date**: Latest stock levels automatically
- **Faster Workflow**: One-click RFQ creation
- **Error Prevention**: No CSV formatting issues
- **Preview Before Create**: See what will be included

### 14. Future Enhancements

1. **Auto-sync**: Periodic background sync
2. **Webhooks**: Real-time updates from Dear Inventory
3. **Bidirectional Sync**: Update Dear Inventory when RFQ is completed
4. **Purchase Order Creation**: Auto-create POs in Dear Inventory
5. **Inventory Alerts**: Notify when stock levels change
6. **Multi-location Support**: Handle multiple warehouse locations
7. **Supplier Performance Tracking**: Link supplier quotes to Dear Inventory supplier records

1. **Auto-sync**: Periodic background sync
2. **Webhooks**: Real-time updates from Dear Inventory
3. **Bidirectional Sync**: Update Dear Inventory when RFQ is completed
4. **Purchase Order Creation**: Auto-create POs in Dear Inventory
5. **Inventory Alerts**: Notify when stock levels change
6. **Multi-location Support**: Handle multiple warehouse locations

### 15. Dependencies

```json
{
  "dependencies": {
    "axios": "^1.6.0",  // HTTP client for API calls
    "crypto-js": "^4.2.0"  // For encrypting API keys
  }
}
```

### 16. Testing Strategy

1. **Unit Tests**: Test API client functions
2. **Integration Tests**: Test with Dear Inventory sandbox/test account
3. **Error Scenarios**: Test API failures, rate limits, invalid credentials
4. **Data Mapping**: Verify all fields map correctly
5. **Performance Tests**: Test with large product catalogs
6. **Supplier Sync Tests**: Test merge strategies, duplicate handling
7. **User Acceptance**: Test with real users and workflows

1. **Unit Tests**: Test API client functions
2. **Integration Tests**: Test with Dear Inventory sandbox/test account
3. **Error Scenarios**: Test API failures, rate limits, invalid credentials
4. **Data Mapping**: Verify all fields map correctly
5. **Performance Tests**: Test with large product catalogs
6. **User Acceptance**: Test with real users and workflows

### 17. Documentation Updates

- Update README with API setup instructions
- Create user guide for Dear Inventory integration
- Document API configuration process
- Add troubleshooting guide

### 18. Rollback Plan

- Keep CSV import as fallback
- Feature flag to enable/disable API integration
- Ability to switch back to CSV if issues arise
- Data export capability for backup

## Estimated Timeline

- **Step 1-2**: 2-3 days (API client + configuration)
- **Step 3**: 1-2 days (Supplier sync implementation)
- **Step 4-5**: 3-4 days (UI integration + data processing)
- **Step 6**: 2-3 days (Testing & refinement)
- **Total**: ~8-12 days

## Next Steps

1. **Review API Documentation**: Study Dear Inventory API docs in detail
2. **Get API Credentials**: Obtain test account and API keys
3. **Prototype**: Build basic API client and test connection
4. **Map Data Structure**: Understand Dear Inventory data format
5. **Implement**: Build full integration following plan

## Notes

- Dear Inventory API may have specific authentication requirements
- Rate limits and pagination need to be verified from documentation
- Some fields may need custom field mapping depending on setup
- Consider API versioning for future compatibility

