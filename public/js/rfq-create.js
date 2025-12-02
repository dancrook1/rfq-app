// RFQ Create page - Full implementation
let globalSuppliers = [];
let dearConfig = null;
let dearProducts = [];
let fetchingProducts = false;
let loading = false;

document.addEventListener('DOMContentLoaded', () => {
  fetchGlobalSuppliers();
  checkDearConfig();
  fetchUrgentItems();
  
  const form = document.getElementById('rfqForm');
  const dataSourceRadios = document.querySelectorAll('input[name="dataSource"]');
  const csvSection = document.getElementById('csvSection');
  const apiSection = document.getElementById('apiSection');
  const fetchProductsBtn = document.getElementById('fetchProducts');
  
  // Toggle between CSV and API sections
  dataSourceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'csv') {
        csvSection.classList.remove('d-none');
        apiSection.classList.add('d-none');
        dearProducts = [];
        updateProductsPreview();
      } else {
        csvSection.classList.add('d-none');
        apiSection.classList.remove('d-none');
      }
    });
  });
  
  // Fetch products from Dear Inventory
  if (fetchProductsBtn) {
    fetchProductsBtn.addEventListener('click', handleFetchFromDear);
  }
  
  // CSV file change
  const csvFileInput = document.getElementById('csvFile');
  if (csvFileInput) {
    csvFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        updateProductsPreview();
      }
    });
  }
  
  form.addEventListener('submit', handleSubmit);
});

async function fetchGlobalSuppliers() {
  try {
    const response = await fetch('/api/settings/suppliers');
    const data = await response.json();
    globalSuppliers = data;
    updateGlobalSuppliersDisplay();
  } catch (error) {
    console.error('Error fetching global suppliers:', error);
  }
}

let urgentItems = [];

async function fetchUrgentItems() {
  try {
    const response = await fetch('/api/urgent-stock');
    const data = await response.json();
    if (data.success) {
      urgentItems = data.items || [];
      updateGlobalSuppliersDisplay();
    }
  } catch (error) {
    console.error('Error fetching urgent items:', error);
  }
}

function updateGlobalSuppliersDisplay() {
  const infoDiv = document.querySelector('.global-suppliers-info');
  if (!infoDiv) return;
  
  let html = '';
  
  // Urgent items info
  if (urgentItems.length > 0) {
    html += `
      <div class="alert alert-danger mt-3">
        <p class="mb-2 fw-semibold">
          🚨 ${urgentItems.length} urgent stock item${urgentItems.length !== 1 ? 's' : ''} will be automatically added to this RFQ:
        </p>
        <ul class="mb-0 small">
          ${urgentItems.slice(0, 5).map(item => `<li><code>${item.sku}</code> - ${item.productName || 'Unknown'}</li>`).join('')}
          ${urgentItems.length > 5 ? `<li class="text-muted">... and ${urgentItems.length - 5} more</li>` : ''}
        </ul>
        <p class="mb-0 mt-2 small">
          <a href="/urgent-stock" class="alert-link fw-semibold">Manage urgent stock items</a>
        </p>
      </div>
    `;
  }
  
  // Global suppliers info
  if (globalSuppliers.length > 0) {
    html += `
      <div class="alert alert-info mt-3">
        <p class="mb-2 fw-semibold">
          ℹ️ ${globalSuppliers.length} global supplier${globalSuppliers.length !== 1 ? 's' : ''} will be automatically added:
        </p>
        <ul class="mb-0 small">
          ${globalSuppliers.map(s => `<li>${s.name}</li>`).join('')}
        </ul>
      </div>
    `;
  } else {
    html += `
      <div class="alert alert-warning mt-3">
        <p class="mb-0">
          ⚠️ No global suppliers found. <a href="/settings" class="alert-link fw-semibold">Add suppliers in Settings</a> to automatically include them in new RFQs.
        </p>
      </div>
    `;
  }
  
  infoDiv.innerHTML = html;
}

async function checkDearConfig() {
  try {
    const response = await fetch('/api/settings/dear-inventory');
    const data = await response.json();
    if (data.config) {
      dearConfig = data.config;
      const apiRadio = document.querySelector('input[value="api"]');
      if (apiRadio) {
        apiRadio.disabled = false;
        const label = apiRadio.closest('label');
        if (label) {
          label.querySelector('span').textContent = 'Dear Inventory API';
        }
      }
    }
  } catch (error) {
    console.error('Error checking Dear Inventory config:', error);
  }
}

async function handleFetchFromDear() {
  fetchingProducts = true;
  const statusDiv = document.getElementById('apiStatus');
  const btn = document.getElementById('fetchProducts');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Fetching...';
  }
  
  if (statusDiv) {
    statusDiv.innerHTML = '';
  }
  
  try {
    const response = await fetch('/api/dear-inventory/products');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch products');
    }
    
    dearProducts = data.products || [];
    
    if (dearProducts.length === 0) {
      if (statusDiv) {
        statusDiv.innerHTML = `<div class="alert alert-danger mt-2">
          ${data.message || 'No products found that need restocking.'}
        </div>`;
      }
    } else {
      if (statusDiv) {
        statusDiv.innerHTML = `<div class="alert alert-success mt-2">
          ✓ Found ${dearProducts.length} product${dearProducts.length !== 1 ? 's' : ''} that need restocking
        </div>`;
      }
    }
    
    updateProductsPreview();
  } catch (err) {
    if (statusDiv) {
      statusDiv.innerHTML = `<div class="alert alert-danger mt-2">
        ${err.message || 'Failed to fetch products from Dear Inventory'}
      </div>`;
    }
  } finally {
    fetchingProducts = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Fetch Products from Dear Inventory';
    }
  }
}

function updateProductsPreview() {
  const preview = document.getElementById('productsPreview');
  const count = document.getElementById('productCount');
  const tbody = document.getElementById('productsTableBody');
  
  if (!preview || !count || !tbody) return;
  
  const dataSource = document.querySelector('input[name="dataSource"]:checked')?.value;
  let items = [];
  
  if (dataSource === 'api') {
    items = dearProducts;
  } else if (dataSource === 'csv') {
    const fileInput = document.getElementById('csvFile');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      preview.classList.add('d-none');
      return;
    }
    // CSV preview will be shown after parsing
    preview.classList.add('d-none');
    return;
  }
  
  if (items.length === 0) {
    preview.classList.add('d-none');
    return;
  }
  
  preview.classList.remove('d-none');
  count.textContent = items.length;
  
  tbody.innerHTML = items.slice(0, 10).map(item => `
    <tr>
      <td>${item.sku || ''}</td>
      <td>${item.productName || ''}</td>
      <td>${item.category || ''}</td>
      <td class="text-end">${item.quantity || 0}</td>
    </tr>
  `).join('');
  
  if (items.length > 10) {
    tbody.innerHTML += `<tr><td colspan="4" class="text-center text-muted">... and ${items.length - 10} more</td></tr>`;
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  
  const rfqName = document.getElementById('rfqName').value;
  const priceThreshold = document.getElementById('priceThreshold').value;
  const dataSource = document.querySelector('input[name="dataSource"]:checked')?.value;
  const csvFile = document.getElementById('csvFile')?.files?.[0];
  const errorDiv = document.getElementById('errorMessage');
  
  if (!rfqName) {
    showError('Please provide RFQ name');
    return;
  }
  
  if (dataSource === 'csv' && !csvFile) {
    showError('Please provide CSV file');
    return;
  }
  
  if (dataSource === 'api' && dearProducts.length === 0) {
    showError('Please fetch products from Dear Inventory first');
    return;
  }
  
  loading = true;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Processing...';
  }
  
  hideError();
  
  try {
    let items = [];
    
    if (dataSource === 'csv') {
      // Parse CSV using PapaParse (loaded from CDN)
      const text = await csvFile.text();
      items = await parseCSV(text);
    } else {
      // Use Dear Inventory products
      items = dearProducts.map(product => ({
        sku: product.sku,
        productName: product.productName,
        category: product.category,
        targetPrice: product.targetPrice,
        quantity: product.quantity,
        onOrder: product.onOrder
      }));
    }
    
    // Send to API
    const response = await fetch('/api/rfq/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: rfqName,
        priceThreshold: parseFloat(priceThreshold),
        items: items
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create RFQ');
    }
    
    const data = await response.json();
    window.location.href = `/rfq/${data.rfqId}`;
  } catch (err) {
    showError(err.message || 'Failed to process data');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create RFQ';
    }
    loading = false;
  }
}

function parseCSV(text) {
  return new Promise((resolve, reject) => {
    // Use PapaParse if available, otherwise use simple CSV parser
    if (typeof Papa !== 'undefined') {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const rows = results.data;
            
            if (rows.length === 0) {
              reject(new Error('CSV file is empty'));
              return;
            }
            
            const items = rows
              .filter(row => {
                const sku = row.SKU?.trim();
                const available = parseFloat(row.Available || '0');
                if (!sku || sku.startsWith('SYS_') || sku.startsWith('MPC_')) {
                  return false;
                }
                return available < 0;
              })
              .map(row => {
                const available = parseFloat(row.Available || '0');
                const onOrder = parseFloat(row.OnOrder || '0');
                const quantityNeeded = Math.max(0, Math.abs(available) - onOrder);
                const salesPrice = parseFloat(row.PriceTier1 || '0');
                const expectedBuyPrice = salesPrice > 0 ? salesPrice / 1.2 : 0;
                
                return {
                  sku: row.SKU?.trim() || '',
                  productName: row.ProductName?.trim() || '',
                  category: row.Category?.trim() || 'Other',
                  targetPrice: expectedBuyPrice,
                  quantity: quantityNeeded,
                  onOrder: Math.max(0, onOrder)
                };
              });
            
            resolve(items);
          } catch (err) {
            reject(err);
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        }
      });
    } else {
      // Simple CSV parser fallback
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const items = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        
        const sku = row.SKU?.trim();
        const available = parseFloat(row.Available || '0');
        if (sku && !sku.startsWith('SYS_') && !sku.startsWith('MPC_') && available < 0) {
          const onOrder = parseFloat(row.OnOrder || '0');
          const quantityNeeded = Math.max(0, Math.abs(available) - onOrder);
          const salesPrice = parseFloat(row.PriceTier1 || '0');
          const expectedBuyPrice = salesPrice > 0 ? salesPrice / 1.2 : 0;
          
          items.push({
            sku: sku,
            productName: row.ProductName?.trim() || '',
            category: row.Category?.trim() || 'Other',
            targetPrice: expectedBuyPrice,
            quantity: quantityNeeded,
            onOrder: Math.max(0, onOrder)
          });
        }
      }
      
      resolve(items);
    }
  });
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.classList.remove('d-none');
    errorDiv.innerHTML = message;
  }
}

function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.classList.add('d-none');
    errorDiv.innerHTML = '';
  }
}
