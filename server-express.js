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
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const rfqRoutes = require('./routes/rfq');
const supplierRoutes = require('./routes/supplier');
const settingsRoutes = require('./routes/settings');
const dearInventoryRoutes = require('./routes/dear-inventory');

app.use('/api/rfq', rfqRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dear-inventory', dearInventoryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/rfq/list', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rfq-list.html'));
});

app.get('/rfq/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rfq-create.html'));
});

app.get('/rfq/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rfq-detail.html'));
});

app.get('/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/supplier/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'supplier-portal.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

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

