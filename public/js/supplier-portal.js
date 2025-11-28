// Supplier Portal - Full implementation
let supplierData = null;
let quotes = {};
let saving = false;
let saved = false;
let activeCategory = 'all';
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const token = pathParts[pathParts.length - 1];
  
  if (token) {
    fetchSupplierData(token);
    
    // Auto-refresh every 5 seconds
    refreshInterval = setInterval(() => {
      fetchSupplierData(token, true);
    }, 5000);
  }
});

async function fetchSupplierData(token, skipQuoteInit = false) {
  try {
    const response = await fetch(`/api/supplier/${token}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Invalid supplier token' }));
      throw new Error(errorData.message || 'Invalid supplier token');
    }
    const data = await response.json();
    supplierData = data;
    
    // Initialize quotes object only if not skipping
    if (!skipQuoteInit) {
      const initialQuotes = {};
      if (data.rfq && data.rfq.items) {
        data.rfq.items.forEach((item) => {
          if (data.existingQuotes && data.existingQuotes[item.id]) {
            initialQuotes[item.id] = data.existingQuotes[item.id];
          } else {
            initialQuotes[item.id] = {
              rfqItemId: item.id,
              quotedPrice: '',
              supplierMpn: '',
              comments: ''
            };
          }
        });
      }
      quotes = initialQuotes;
      activeCategory = 'all';
    }
    
    displaySupplierPortal();
  } catch (error) {
    console.error('Error fetching supplier data:', error);
    const loadingDiv = document.getElementById('loading');
    const contentDiv = document.getElementById('content');
    if (loadingDiv) {
      loadingDiv.innerHTML = `<p style="color: #dc2626;">Error: ${error.message}</p>`;
    }
    if (contentDiv) {
      contentDiv.style.display = 'none';
    }
  } finally {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv && supplierData) {
      loadingDiv.style.display = 'none';
    }
  }
}

function displaySupplierPortal() {
  if (!supplierData || !supplierData.rfq || !supplierData.rfq.items) {
    console.error('Invalid supplier data:', supplierData);
    return;
  }
  
  const content = document.getElementById('content');
  const loadingDiv = document.getElementById('loading');
  
  if (!content) return;
  
  // Hide loading, show content
  if (loadingDiv) loadingDiv.classList.add('d-none');
  content.classList.remove('d-none');
  
  const categories = Array.from(new Set(supplierData.rfq.items.map(item => item.category || 'Other'))).sort();
  const itemsInCategory = activeCategory === 'all' 
    ? supplierData.rfq.items 
    : supplierData.rfq.items.filter(item => item.category === activeCategory);
  
  // Group items by category
  const groupedByCategory = itemsInCategory.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});
  
  content.innerHTML = `
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h1 class="h3 fw-bold mb-2">${supplierData.rfq.name}</h1>
            <p class="text-muted mb-0">Supplier: ${supplierData.name}</p>
          </div>
          <button
            id="submitBtn"
            onclick="handleSubmit()"
            class="btn ${saved ? 'btn-success' : saving ? 'btn-secondary' : 'btn-primary'}"
          >
            ${saved ? '✓ Saved!' : saving ? '<span class="spinner-border spinner-border-sm me-2"></span>Saving...' : 'Submit Prices'}
          </button>
        </div>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex gap-2 flex-wrap">
          <button
            onclick="setActiveCategory('all')"
            class="btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : 'btn-outline-secondary'}"
          >
            All Categories (${supplierData.rfq.items.length})
          </button>
          ${categories.map(category => {
            const categoryCount = supplierData.rfq.items.filter(item => item.category === category).length;
            return `
              <button
                onclick="setActiveCategory('${category}')"
                class="btn btn-sm ${activeCategory === category ? 'btn-primary' : 'btn-outline-secondary'}"
              >
                ${category} (${categoryCount})
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <div class="card shadow-sm">
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>MPN</th>
              <th class="text-end">Target Price</th>
              <th class="text-end">Current Lowest</th>
              <th class="text-end">Quantity</th>
              <th class="text-end">Your Price</th>
              <th>Your MPN</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedByCategory).flatMap(([category, items]) => [
              `<tr class="table-secondary">
                <td colspan="9" class="py-3">
                  <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold h6 mb-0">${category}</span>
                    <span class="text-muted small">(${items.length} ${items.length === 1 ? 'item' : 'items'})</span>
                  </div>
                </td>
              </tr>`,
              ...items.map(item => {
                const quote = quotes[item.id] || {
                  rfqItemId: item.id,
                  quotedPrice: '',
                  supplierMpn: '',
                  comments: ''
                };
                const isWinning = item.isWinning || false;
                return `
                  <tr class="${isWinning ? 'table-success' : ''}">
                    <td class="font-monospace small">${item.sku}</td>
                    <td>${item.productName}</td>
                    <td class="font-monospace small">${item.mpn}</td>
                    <td class="text-end fw-semibold">£${(item.targetPrice || 0).toFixed(2)}</td>
                    <td class="text-end">
                      ${item.bestPrice && item.bestPrice > 0 ? 
                        `<span class="text-success fw-semibold">£${item.bestPrice.toFixed(2)}</span>` : 
                        '<span class="text-muted">No quotes yet</span>'
                      }
                    </td>
                    <td class="text-end">${item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value="${quote.quotedPrice}"
                        onchange="updateQuote('${item.id}', 'quotedPrice', this.value)"
                        class="form-control form-control-sm"
                        style="width: 6rem;"
                        placeholder="0.00"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value="${quote.supplierMpn || ''}"
                        onchange="updateQuote('${item.id}', 'supplierMpn', this.value)"
                        class="form-control form-control-sm"
                        style="width: 8rem;"
                        placeholder="Your MPN"
                      />
                    </td>
                    <td>
                      <textarea
                        onchange="updateQuote('${item.id}', 'comments', this.value)"
                        oninput="updateQuote('${item.id}', 'comments', this.value)"
                        class="form-control form-control-sm"
                        style="width: 12rem;"
                        placeholder="Comments..."
                        rows="2"
                      >${(quote.comments || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</textarea>
                    </td>
                  </tr>
                `;
              })
            ]).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function setActiveCategory(category) {
  activeCategory = category;
  displaySupplierPortal();
}

function updateQuote(itemId, field, value) {
  if (!quotes[itemId]) {
    quotes[itemId] = {
      rfqItemId: itemId,
      quotedPrice: '',
      supplierMpn: '',
      comments: ''
    };
  }
  quotes[itemId][field] = value;
  saved = false;
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn && !saving) {
    submitBtn.className = 'btn btn-primary';
    submitBtn.textContent = 'Submit Prices';
  }
}

async function handleSubmit() {
  if (!supplierData) return;
  
  const pathParts = window.location.pathname.split('/');
  const token = pathParts[pathParts.length - 1];
  
  saving = true;
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.background = '#9ca3af';
    submitBtn.textContent = 'Saving...';
  }
  
  try {
    const response = await fetch(`/api/supplier/${token}/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quotes: Object.values(quotes)
      })
    });
    
    if (response.ok) {
      saved = true;
      if (submitBtn) {
        submitBtn.style.background = '#059669';
        submitBtn.textContent = '✓ Saved!';
      }
      setTimeout(() => {
        saved = false;
        if (submitBtn) {
          submitBtn.style.background = '#2563eb';
          submitBtn.textContent = 'Submit Prices';
        }
      }, 3000);
    }
  } catch (error) {
    console.error('Error saving quotes:', error);
    alert('Failed to save quotes. Please try again.');
  } finally {
    saving = false;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
}
