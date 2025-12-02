const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// Single server entry point

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS)
// In Vercel, __dirname points to the api directory, so we need to go up one level
const publicPath = path.join(__dirname, process.env.VERCEL ? '../public' : 'public');
app.use(express.static(publicPath));

// API Routes
const rfqRoutes = require('./routes/rfq');
const supplierRoutes = require('./routes/supplier');
const settingsRoutes = require('./routes/settings');
const dearInventoryRoutes = require('./routes/dear-inventory');
const urgentStockRoutes = require('./routes/urgent-stock');

app.use('/api/rfq', rfqRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dear-inventory', dearInventoryRoutes);
app.use('/api/urgent-stock', urgentStockRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve HTML pages
const htmlPath = (filename) => path.join(publicPath, filename);

app.get('/', (req, res) => {
  res.sendFile(htmlPath('index.html'));
});

app.get('/rfq/list', (req, res) => {
  res.sendFile(htmlPath('rfq-list.html'));
});

app.get('/rfq/create', (req, res) => {
  res.sendFile(htmlPath('rfq-create.html'));
});

app.get('/rfq/:id', (req, res) => {
  res.sendFile(htmlPath('rfq-detail.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(htmlPath('settings.html'));
});

app.get('/supplier/:token', (req, res) => {
  res.sendFile(htmlPath('supplier-portal.html'));
});

app.get('/urgent-stock', (req, res) => {
  res.sendFile(htmlPath('urgent-stock.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server (only if not in Vercel serverless environment)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;

