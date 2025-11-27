# RFQ Management System

A Next.js web application for managing Request for Quotations (RFQ) from suppliers.

## Features

- **CSV Import**: Import RFQ data from Availability Report CSV files
- **Dear Inventory (Cin7) API Integration**: Fetch products and suppliers directly from Dear Inventory
- **Automatic Supplier Sync**: Synchronize suppliers from Dear Inventory with merge/replace/supplement strategies
- **Product Lookup**: Automatically extracts product name, MPN, and category from CSV data or API
- **Supplier Portal**: Unique links for each supplier to view and submit quotes
- **Category Organization**: Products organized by categories (Motherboard, GPU, CPU, etc.)
- **Quote Management**: Suppliers can submit prices, MPNs, and comments for each item
- **Summary Dashboard**: View all quotes, filter by category, identify cheapest prices
- **Price Alerts**: Highlights price increases beyond set threshold
- **CSV Export**: Export selected quotes to CSV for ERP system integration

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Setting Up Dear Inventory API (Optional)

1. Navigate to "Settings"
2. Enter your Dear Inventory Account ID and Application Key
3. Test the connection
4. Save the configuration
5. Use "Sync Suppliers from Dear Inventory" to import your suppliers

**Note**: The Application Key is encrypted in the database. Set `DEAR_INVENTORY_ENCRYPTION_KEY` environment variable for production use.

### Creating an RFQ

1. Navigate to "Create New RFQ"
2. Enter RFQ name and price threshold percentage
3. Choose data source:
   - **CSV Upload**: Upload your Availability Report CSV file
   - **Dear Inventory API**: Click "Fetch Products from Dear Inventory" to get real-time data
4. The system will automatically extract product names, MPNs, and categories

### Adding Suppliers

**Option 1: Global Suppliers (Recommended)**
1. Go to Settings
2. Add suppliers manually or sync from Dear Inventory
3. Global suppliers are automatically added to new RFQs

**Option 2: RFQ-Specific Suppliers**
1. Open an RFQ
2. Go to "Manage Suppliers" tab
3. Add supplier name and email
4. Copy the unique supplier link
5. Send the link to your supplier

### Supplier Portal

Suppliers can:
- View all RFQ items organized by category
- Submit quoted prices
- Provide their own MPN
- Add comments for each item
- Save their quotes

### Summary & Export

1. Navigate to the RFQ Summary page
2. Filter by category and sort by price or name
3. View all quotes with cheapest prices highlighted
4. Price increases beyond threshold are marked in red
5. Export selected quotes to CSV for ERP integration

## CSV Format

### Import Format (Availability Report)
The system accepts your standard Availability Report CSV with the following required columns:
- `SKU`: Product SKU (MPN is automatically extracted from SKU format: `XX_XX_MPN`)
- `ProductName`: Product name
- `Category`: Product category
- `PriceTier1`: Expected buy price
- `Available` or `OnHand`: Quantity needed

Example:
```csv
Category,SKU,ProductName,PriceTier1,Available
"DDR5 Memory","MM_W2F_32D56000DC","32GB non-RGB DDR5 6000MHz (2 x 16GB)",105.00,4
"AMD Ryzen Processors (AM5)","CP_AMD_9600X","AMD Ryzen 5 9600X 6-Core 5.4GHz",241.66,4
```

**MPN Extraction**: The MPN is automatically extracted from the SKU format. For SKUs like `MM_W2F_32D56000DC`, the MPN is `32D56000DC` (the part after the second underscore).

### Export Format
The exported CSV includes:
- SKU, Product Name, MPN, Category
- Quantity, Expected Price
- Selected Supplier, Selected Price, Selected MPN
- Supplier Comments

## Database

The application uses SQLite with Prisma ORM. To view the database:
```bash
npx prisma studio
```

## Customization

### MPN Extraction

The MPN extraction logic is in `lib/sku-lookup.ts`. The function `extractMPNFromSKU()` handles SKU formats like:
- `CATEGORY_BRAND_MPN` → MPN is the 3rd segment
- `CATEGORY_BRAND_MPN_SUFFIX` → MPN is the 3rd segment
- `PREFIX-CATEGORY_BRAND_MPN_SUFFIX` → MPN is extracted after removing prefix

### Categories

Categories are automatically extracted from the CSV `Category` column.

## Tech Stack

- Next.js 14
- TypeScript
- Prisma (SQLite)
- Tailwind CSS
- PapaParse (CSV handling)
- CryptoJS (API key encryption)
- Dear Inventory (Cin7) API integration

## Environment Variables

Create a `.env` file in the root directory:

```env
# Dear Inventory API Encryption Key (required for production)
# Generate a strong random key for encrypting API credentials
DEAR_INVENTORY_ENCRYPTION_KEY=your-secure-encryption-key-here
```

