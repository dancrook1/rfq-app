# RFQ Management System

A Node.js web application for managing Request for Quotations (RFQ) from suppliers. Built with Express.js, vanilla JavaScript, and Bootstrap CSS.

## Features

- **Dear Inventory (Cin7) API Integration**: Fetch products and suppliers directly from Dear Inventory
- **Automatic Supplier Sync**: Synchronize suppliers from Dear Inventory
- **Supplier Portal**: Unique links for each supplier to view and submit quotes
- **Category Organization**: Products organized by categories with filtering
- **Quote Management**: Suppliers can submit prices, MPNs, and comments
- **Summary Dashboard**: View all quotes, filter, identify cheapest prices
- **Price Alerts**: Highlights price increases beyond set threshold
- **Purchase Order Creation**: Push winning quotes to Cin7 as Purchase Orders
- **Resizable Tables**: Interactive tables with resizable columns
- **Real-time Updates**: Auto-refreshing summary page

## Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: Plain HTML, CSS (Bootstrap 5.3.2), and Vanilla JavaScript
- **Database**: Prisma ORM with SQLite (or PostgreSQL)
- **Styling**: Bootstrap CSS with minimal custom CSS

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

```bash
npx prisma generate
npx prisma db push
```

### 3. Configure Environment

Create a `.env` file:

```env
DEAR_INVENTORY_ENCRYPTION_KEY=your-secure-encryption-key
DATABASE_URL=file:./prisma/dev.db
PORT=3000
```

### 4. Run the Server

```bash
npm run dev
```

Or for production:

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
/
├── server.js              # Main entry point (Express server)
├── routes/                # API route handlers
│   ├── rfq.js
│   ├── rfq-id.js
│   ├── rfq-supplier.js
│   ├── supplier.js
│   ├── settings.js
│   └── dear-inventory.js
├── lib/                   # Helper libraries
│   ├── prisma.js
│   ├── sku-filter.js
│   └── dear-inventory.js
├── public/                # Static files (HTML, CSS, JS)
│   ├── index.html
│   ├── rfq-create.html
│   ├── rfq-detail.html
│   ├── settings.html
│   ├── supplier-portal.html
│   ├── css/
│   │   ├── style.css
│   │   └── table-resize.css
│   └── js/
│       ├── home.js
│       ├── rfq-create.js
│       ├── rfq-detail.js
│       ├── settings.js
│       └── supplier-portal.js
└── prisma/
    └── schema.prisma      # Database schema
```

## Usage

### Setting Up Dear Inventory API

1. Navigate to "Settings"
2. Enter your Dear Inventory Account ID and Application Key
3. Test the connection
4. Save the configuration

### Creating an RFQ

1. Navigate to "Create New RFQ"
2. Enter RFQ name and price threshold
3. Choose data source:
   - **CSV Upload**: Upload your Availability Report CSV file (legacy)
   - **Dear Inventory API**: Click "Fetch Products from Dear Inventory" (recommended)
4. The system will automatically extract product names, MPNs, and categories

### Adding Suppliers

**Option 1: Global Suppliers (Recommended)**
1. Go to Settings
2. Add suppliers manually or sync from Dear Inventory
3. Global suppliers are automatically added to new RFQs

**Option 2: RFQ-Specific Suppliers**
1. Open an RFQ
2. Go to "Manage Suppliers" tab
3. Add suppliers manually or select from global suppliers

### Supplier Portal

1. Share the unique supplier portal link with suppliers
2. Suppliers can view RFQ items by category
3. Suppliers submit prices, MPNs, and comments
4. Real-time updates show current lowest prices

### Summary Dashboard

- View all quotes in a filterable table
- Filter by unavailable items or items exceeding threshold
- See winning suppliers highlighted
- Export to CSV for ERP import
- Create Purchase Orders directly in Cin7

## API Endpoints

All API endpoints are under `/api/`:

### RFQ Endpoints
- `GET /api/rfq/list` - List all RFQs
- `POST /api/rfq/create` - Create new RFQ
- `GET /api/rfq/:id` - Get RFQ details
- `GET /api/rfq/:id/summary` - Get RFQ summary
- `POST /api/rfq/:id/supplier` - Add supplier to RFQ
- `POST /api/rfq/:id/supplier/:supplierId/create-po` - Create PO in Cin7

### Supplier Endpoints
- `GET /api/supplier/:token` - Get supplier portal data
- `POST /api/supplier/:token/quotes` - Submit quotes

### Settings Endpoints
- `GET /api/settings/suppliers` - Get global suppliers
- `POST /api/settings/suppliers` - Add global supplier
- `GET /api/settings/dear-inventory` - Get Dear Inventory config
- `POST /api/settings/dear-inventory` - Configure Dear Inventory
- `GET /api/settings/sku-exclusions` - Get SKU exclusion patterns
- `POST /api/settings/sku-exclusions` - Add SKU exclusion pattern
- `GET /api/settings/category-exclusions` - Get category exclusion patterns
- `POST /api/settings/category-exclusions` - Add category exclusion pattern

### Dear Inventory Endpoints
- `GET /api/dear-inventory/products` - Fetch products needing restock

## Deployment

### cPanel Deployment

See `CPANEL_DEPLOYMENT.md` for detailed instructions.

### General Deployment

1. Set environment variables
2. Run `npm install`
3. Run `npx prisma generate`
4. Run `npx prisma db push`
5. Start server: `npm start`

For production, ensure:
- `NODE_ENV=production`
- Database is properly configured (SQLite or PostgreSQL)
- Encryption key is secure and stored safely

## Development

```bash
# Run development server
npm run dev

# Database operations
npm run db:push      # Push schema changes
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Generate Prisma client
```

## Dependencies

### Production
- `express` - Web server framework
- `@prisma/client` - Database ORM
- `cors` - CORS middleware
- `crypto-js` - Encryption for API keys
- `uuid` - Unique identifier generation
- `papaparse` - CSV parsing (legacy)

### Development
- `prisma` - Prisma CLI
- Type definitions for TypeScript support

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Bootstrap 5.3.2 compatible browsers
- JavaScript ES6+ required

## License

Private - All rights reserved
