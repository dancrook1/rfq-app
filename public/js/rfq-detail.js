// RFQ Detail page - Full implementation
let rfq = null;
let summary = [];
let globalSuppliers = [];
let activeTab = 'summary';
let editingQuantity = {};
let updatingQuantity = null;
let showWinningOnly = {};
let overridingItem = null;
let creatingPO = null;
let showNoQuotes = false;
let showExceedsThreshold = false;
let columnFilters = {
  productName: '',
  sku: '',
  mpn: '',
  supplier: ''
};
let sortColumn = '';
let sortDirection = 'asc';
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  if (rfqId) {
    fetchRFQ(rfqId);
    fetchSummary(rfqId);
    fetchGlobalSuppliers();
    
    // Auto-refresh summary every 5 seconds
    refreshInterval = setInterval(() => {
      if (activeTab === 'summary') {
        fetchSummary(rfqId);
      }
    }, 5000);
  }
});

async function fetchRFQ(id) {
  try {
    const response = await fetch(`/api/rfq/${id}`);
    const data = await response.json();
    rfq = data;
    document.getElementById('rfqTitle').textContent = rfq.name;
    
    // Update RFQ info (removed duplicate title, keeping only stats)
    const rfqInfo = document.getElementById('rfqInfo');
    if (rfqInfo) {
      rfqInfo.innerHTML = `
        <div class="d-flex align-items-center gap-3 small text-muted">
          <span>${rfq.items.length} items</span>
          <span>•</span>
          <span>${rfq.suppliers.length} suppliers</span>
          <span>•</span>
          <span>Threshold: ${rfq.priceThreshold}%</span>
        </div>
      `;
    }
    
    document.getElementById('loading').classList.add('d-none');
    document.getElementById('content').classList.remove('d-none');
    renderTabs();
    renderTabContent();
  } catch (error) {
    console.error('Error fetching RFQ:', error);
    document.getElementById('loading').innerHTML = '<p style="color: #dc2626;">Error loading RFQ</p>';
  }
}

async function fetchSummary(id) {
  try {
    const response = await fetch(`/api/rfq/${id}/summary`);
    const data = await response.json();
    summary = data.summary || [];
    if (activeTab === 'summary') {
      renderTabContent();
    }
  } catch (error) {
    console.error('Error fetching summary:', error);
  }
}

async function fetchGlobalSuppliers() {
  try {
    const response = await fetch('/api/settings/suppliers');
    const data = await response.json();
    globalSuppliers = data;
  } catch (error) {
    console.error('Error fetching global suppliers:', error);
  }
}

function renderTabs() {
  const tabsDiv = document.getElementById('tabs');
  if (!tabsDiv || !rfq) return;
  
  tabsDiv.innerHTML = `
    <ul class="nav nav-tabs border-bottom flex-nowrap overflow-x-auto">
      <li class="nav-item">
        <button
          onclick="setActiveTab('summary')"
          class="nav-link ${activeTab === 'summary' ? 'active' : ''} text-nowrap"
        >
          📊 Summary
        </button>
      </li>
      ${rfq.suppliers.map(supplier => `
        <li class="nav-item">
          <button
            onclick="setActiveTab('${supplier.id}')"
            class="nav-link ${activeTab === supplier.id ? 'active' : ''} text-nowrap"
          >
            👤 ${supplier.name}
          </button>
        </li>
      `).join('')}
      <li class="nav-item">
        <button
          onclick="setActiveTab('manage')"
          class="nav-link ${activeTab === 'manage' ? 'active' : ''} text-nowrap"
        >
          ⚙️ Manage Suppliers
        </button>
      </li>
    </ul>
  `;
}

function setActiveTab(tab) {
  activeTab = tab;
  renderTabs();
  renderTabContent();
}

function renderTabContent() {
  const tabContent = document.getElementById('tabContent');
  if (!tabContent || !rfq) return;
  
  if (activeTab === 'summary') {
    tabContent.innerHTML = renderSummaryTab();
    // Initialize column resizing after summary table is rendered
    setTimeout(() => initColumnResizing(), 100);
  } else if (activeTab === 'manage') {
    tabContent.innerHTML = renderManageSuppliersTab();
  } else {
    const supplier = rfq.suppliers.find(s => s.id === activeTab);
    if (supplier) {
      tabContent.innerHTML = renderSupplierTab(supplier);
      // Initialize column resizing after supplier table is rendered
      setTimeout(() => initColumnResizing(), 100);
    }
  }
}

function getCheapestQuote(quotes, forcedSupplierId = null) {
  const validQuotes = quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0);
  if (validQuotes.length === 0) return null;
  
  if (forcedSupplierId) {
    const forcedQuote = validQuotes.find(q => q.supplierId === forcedSupplierId);
    if (forcedQuote) return forcedQuote;
  }
  
  return validQuotes.reduce((min, q) => 
    (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
  );
}

function isPriceIncrease(targetPrice, quotedPrice) {
  if (!quotedPrice || !rfq) return false;
  const increase = ((quotedPrice - targetPrice) / targetPrice) * 100;
  return increase > (rfq.priceThreshold || 10);
}

function renderSummaryTab() {
  if (!rfq || !summary) return '';
  
  // Apply filters
  let filteredSummary = summary.filter(item => {
    const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId);
    
    if (columnFilters.productName && !item.productName.toLowerCase().includes(columnFilters.productName.toLowerCase())) {
      return false;
    }
    if (columnFilters.sku && !item.sku.toLowerCase().includes(columnFilters.sku.toLowerCase())) {
      return false;
    }
    if (columnFilters.mpn && !item.mpn.toLowerCase().includes(columnFilters.mpn.toLowerCase())) {
      return false;
    }
    if (columnFilters.supplier && cheapest?.supplierName !== columnFilters.supplier) {
      return false;
    }
    
    if (showNoQuotes) {
      const hasAnyQuote = item.quotes.some(q => q.quotedPrice !== null && q.quotedPrice > 0);
      if (hasAnyQuote) return false;
    }
    
    if (showExceedsThreshold) {
      if (!cheapest) return false;
      if (!isPriceIncrease(item.targetPrice, cheapest.quotedPrice)) return false;
    }
    
    return true;
  });
  
  // Apply sorting
  if (sortColumn) {
    filteredSummary = [...filteredSummary].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortColumn) {
        case 'productName':
          aValue = a.productName;
          bValue = b.productName;
          break;
        case 'sku':
          aValue = a.sku;
          bValue = b.sku;
          break;
        case 'mpn':
          aValue = a.mpn;
          bValue = b.mpn;
          break;
        case 'targetPrice':
          aValue = a.targetPrice;
          bValue = b.targetPrice;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'bestPrice':
          aValue = getCheapestQuote(a.quotes)?.quotedPrice || Infinity;
          bValue = getCheapestQuote(b.quotes)?.quotedPrice || Infinity;
          break;
        case 'supplier':
          aValue = getCheapestQuote(a.quotes)?.supplierName || '';
          bValue = getCheapestQuote(b.quotes)?.supplierName || '';
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc' 
          ? (aValue || 0) - (bValue || 0)
          : (bValue || 0) - (aValue || 0);
      }
    });
  }
  
  // Group by category
  const groupedByCategory = filteredSummary.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});
  
  const allSuppliers = rfq.suppliers || [];
  const cheapestSupplierIds = new Map(
    filteredSummary.map(item => {
      const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId);
      return [item.itemId, cheapest?.supplierId || null];
    })
  );
  
  // Get unique suppliers from quotes for filter dropdown
  const suppliersFromQuotes = Array.from(new Set(
    summary.flatMap(item => item.quotes.map(q => q.supplierName).filter(Boolean))
  ));
  
  return `
    <div class="card shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <h2 class="h5 fw-bold mb-0">Summary</h2>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <button
              onclick="toggleNoQuotes()"
              class="btn btn-sm ${showNoQuotes ? 'btn-primary' : 'btn-outline-secondary'}"
            >
              ${showNoQuotes ? '✓ Unavailable Only' : 'Filter: Unavailable'}
            </button>
            <button
              onclick="toggleExceedsThreshold()"
              class="btn btn-sm ${showExceedsThreshold ? 'btn-danger' : 'btn-outline-secondary'}"
            >
              ${showExceedsThreshold ? '✓ Exceeds Threshold Only' : 'Filter: Exceeds Threshold'}
            </button>
            <button
              onclick="exportCSV()"
              class="btn btn-sm btn-success"
            >
              📥 Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="overflow: hidden; width: 100%;">
      <div style="overflow-x: auto; width: 100%;">
        <table class="summary-table resizable-table" style="width: 100%; min-width: 100%;">
          <thead>
            <tr>
              <th data-column="productName" style="min-width: 150px; position: sticky; left: 0; background: #f9fafb; z-index: 10; white-space: nowrap;">
                <div class="th-content">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>Product Name</span>
                    <button onclick="handleSort('productName')" style="color: #9ca3af; border: none; background: none; cursor: pointer; padding: 0; font-size: 0.875rem;" title="Sort">
                      ${sortColumn === 'productName' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </button>
                  </div>
                </div>
                <div class="resize-handle" data-column="productName"></div>
              </th>
              <th data-column="sku" style="min-width: 100px; white-space: nowrap;">
                <div class="th-content">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>SKU</span>
                    <button onclick="handleSort('sku')" style="color: #9ca3af; border: none; background: none; cursor: pointer; padding: 0; font-size: 0.875rem;" title="Sort">
                      ${sortColumn === 'sku' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </button>
                  </div>
                </div>
                <div class="resize-handle" data-column="sku"></div>
              </th>
              <th data-column="mpn" style="min-width: 100px; white-space: nowrap;">
                <div class="th-content">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>MPN</span>
                    <button onclick="handleSort('mpn')" style="color: #9ca3af; border: none; background: none; cursor: pointer; padding: 0; font-size: 0.875rem;" title="Sort">
                      ${sortColumn === 'mpn' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                    </button>
                  </div>
                </div>
                <div class="resize-handle" data-column="mpn"></div>
              </th>
              <th data-column="targetPrice" style="min-width: 80px; text-align: right; white-space: nowrap;">
                <div class="th-content" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                  <span>Target</span>
                  <button onclick="handleSort('targetPrice')" style="color: #9ca3af; border: none; background: none; cursor: pointer; padding: 0; font-size: 0.875rem;" title="Sort">
                    ${sortColumn === 'targetPrice' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                  </button>
                </div>
                <div class="resize-handle" data-column="targetPrice"></div>
              </th>
              <th data-column="quantity" style="min-width: 80px; text-align: right; white-space: nowrap;">
                <div class="th-content" style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;">
                  <span>Qty Needed</span>
                  <button onclick="handleSort('quantity')" style="color: #9ca3af; border: none; background: none; cursor: pointer; padding: 0; font-size: 0.875rem;" title="Sort">
                    ${sortColumn === 'quantity' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                  </button>
                </div>
                <div class="resize-handle" data-column="quantity"></div>
              </th>
              <th data-column="onOrder" style="min-width: 80px; text-align: right; white-space: nowrap;">
                <div class="th-content">On Order</div>
                <div class="resize-handle" data-column="onOrder"></div>
              </th>
              ${allSuppliers.map((supplier, idx) => `
                <th data-column="supplier-${supplier.id}" style="min-width: 100px; text-align: right; white-space: nowrap;">
                  <div class="th-content" style="display: flex; align-items: center; justify-content: flex-end;">
                    <span>${supplier.name}</span>
                  </div>
                  <div class="resize-handle" data-column="supplier-${supplier.id}"></div>
                </th>
              `).join('')}
              <th data-column="winning" style="min-width: 100px; text-align: center; position: sticky; right: 0; background: #f9fafb; z-index: 10; white-space: nowrap;">
                <div class="th-content">Winning</div>
                <div class="resize-handle" data-column="winning"></div>
              </th>
              <th data-column="status" style="min-width: 80px; text-align: center; white-space: nowrap;">
                <div class="th-content">Status</div>
                <div class="resize-handle" data-column="status"></div>
              </th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedByCategory).flatMap(([category, items]) => [
              `<tr class="category-header table-secondary">
                <td colspan="${7 + allSuppliers.length + 2}" class="py-3">
                  <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold h6 mb-0">${category}</span>
                    <span class="text-muted small">(${items.length} ${items.length === 1 ? 'item' : 'items'})</span>
                  </div>
                </td>
              </tr>`,
              ...items.map(item => {
                const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId);
                const priceExceedsThreshold = cheapest && isPriceIncrease(item.targetPrice, cheapest.quotedPrice);
                const winningSupplierId = cheapestSupplierIds.get(item.itemId);
                
                // Get all comments for this item
                const allComments = item.quotes
                  .filter(q => q.comments && String(q.comments).trim() !== '')
                  .map(q => {
                    const supplier = allSuppliers.find(s => s.id === q.supplierId);
                    return { supplier: supplier?.name || 'Unknown', comment: q.comments };
                  });
                
                return `
                  <tr style="border-bottom: 1px solid #e5e7eb; ${priceExceedsThreshold ? 'background: rgba(254, 226, 226, 0.15);' : cheapest ? 'background: rgba(209, 250, 229, 0.15);' : ''}">
                    <td style="padding: 0.875rem 1rem; font-weight: 500; color: #111827; position: sticky; left: 0; background: white; z-index: 0; white-space: nowrap;">
                      <div style="display: flex; align-items: center; gap: 0.25rem;">
                        ${item.productName}
                        ${allComments.length > 0 ? `
                          <div style="position: relative; display: inline-block;">
                            <span style="font-size: 0.75rem; color: #2563eb; cursor: help;">💬</span>
                            <div style="position: absolute; left: 0; bottom: 100%; margin-bottom: 0.25rem; width: 20rem; padding: 0.75rem; background: #111827; color: white; font-size: 0.75rem; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); opacity: 0; visibility: hidden; pointer-events: none; z-index: 9999; transition: all 0.2s;" 
                                 onmouseenter="this.style.opacity='1'; this.style.visibility='visible';" 
                                 onmouseleave="this.style.opacity='0'; this.style.visibility='hidden';">
                              <div style="font-weight: 600; margin-bottom: 0.5rem; color: #93c5fd;">Supplier Comments:</div>
                              ${allComments.map((c, idx) => `
                                <div style="margin-bottom: 0.5rem; ${idx === allComments.length - 1 ? 'margin-bottom: 0;' : ''}">
                                  <div style="font-weight: 600; color: #93c5fd;">${c.supplier}:</div>
                                  <div style="white-space: pre-wrap; word-break: break-word; margin-left: 0.5rem;">${String(c.comment)}</div>
                                </div>
                              `).join('')}
                              <div style="position: absolute; top: 100%; left: 1rem; width: 0.5rem; height: 0.5rem; background: #111827; transform: rotate(45deg);"></div>
                            </div>
                          </div>
                        ` : ''}
                      </div>
                    </td>
                          <td style="padding: 0.875rem 1rem; color: #4b5563; font-family: monospace; font-size: 0.8125rem; width: 140px;">${item.sku}</td>
                          <td style="padding: 0.875rem 1rem; color: #4b5563; font-family: monospace; font-size: 0.8125rem; width: 140px;">${item.mpn}</td>
                          <td style="padding: 0.875rem 1rem; text-align: right; color: #374151; font-weight: 500; width: 110px;">£${(item.targetPrice || 0).toFixed(2)}</td>
                          <td style="padding: 0.875rem 1rem; text-align: right; color: #374151; font-weight: 500; width: 110px;">
                      ${editingQuantity[item.itemId] !== undefined ? `
                        <input
                          type="number"
                          value="${editingQuantity[item.itemId]}"
                          onchange="handleQuantityChange('${item.itemId}', this.value)"
                          onblur="handleQuantityBlur('${item.itemId}')"
                          onkeydown="handleQuantityKeyDown(event, '${item.itemId}')"
                          style="width: 5rem; padding: 0.25rem 0.5rem; font-size: 0.875rem; text-align: right; border: 1px solid #2563eb; border-radius: 0.25rem;"
                          min="0"
                          autofocus
                        />
                      ` : `
                        <button
                          onclick="handleQuantityChange('${item.itemId}', '${item.quantity}')"
                          style="color: #374151; font-weight: 500; border: none; background: none; cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 0.25rem; hover:background: #f3f4f6;"
                          ${updatingQuantity === item.itemId ? 'disabled' : ''}
                          title="Click to edit quantity"
                        >
                          ${updatingQuantity === item.itemId ? 'Updating...' : item.quantity}
                        </button>
                      `}
                    </td>
                          <td style="padding: 0.875rem 1rem; text-align: right; color: #4b5563; font-weight: 500; white-space: nowrap;">
                            ${item.onOrder > 0 ? item.onOrder : '-'}
                          </td>
                          ${allSuppliers.map(supplier => {
                      const quote = item.quotes.find(q => q.supplierId === supplier.id);
                      const isWinning = winningSupplierId === supplier.id;
                      const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0;
                      const exceedsThreshold = hasQuote && isPriceIncrease(item.targetPrice, quote.quotedPrice);
                      const hasComments = quote && quote.comments && String(quote.comments).trim() !== '';
                      
                      return `
                        <td style="padding: 0.875rem 1rem; text-align: right; font-weight: 500; white-space: nowrap; ${isWinning ? 'background: #d1fae5; font-weight: 700;' : ''} ${exceedsThreshold ? 'color: #dc2626;' : hasQuote ? 'color: #374151;' : 'color: #9ca3af;'}">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;">
                            ${hasQuote ? `£${quote.quotedPrice.toFixed(2)}` : '-'}
                            ${hasComments ? `
                              <div style="position: relative; display: inline-block;">
                                <span style="font-size: 0.75rem; color: #2563eb; cursor: help; hover:color: #1d4ed8;">💬</span>
                                <div style="position: absolute; right: 0; bottom: 100%; margin-bottom: 0.5rem; width: 16rem; padding: 0.75rem; background: #111827; color: white; font-size: 0.75rem; border-radius: 0.5rem; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); opacity: 0; visibility: hidden; pointer-events: none; z-index: 9999; transition: all 0.2s; white-space: normal;"
                                     onmouseenter="this.style.opacity='1'; this.style.visibility='visible';" 
                                     onmouseleave="this.style.opacity='0'; this.style.visibility='hidden';">
                                  <div style="font-weight: 600; margin-bottom: 0.25rem; color: #93c5fd;">${supplier.name} Comments:</div>
                                  <div style="white-space: pre-wrap; word-break: break-word;">${String(quote.comments)}</div>
                                  <div style="position: absolute; top: 100%; right: 1rem; width: 0.5rem; height: 0.5rem; background: #111827; transform: rotate(45deg);"></div>
                                </div>
                              </div>
                            ` : ''}
                          </div>
                        </td>
                      `;
                    }).join('')}
                    <td style="padding: 0.875rem 1rem; text-align: center; position: sticky; right: 0; background: white; z-index: 0; white-space: nowrap;">
                      ${winningSupplierId ? `
                        <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: #fef3c7; color: #92400e; font-weight: 700;">
                          ${allSuppliers.find(s => s.id === winningSupplierId)?.name || 'Winner'}
                        </span>
                      ` : '<span style="color: #9ca3af; font-size: 0.75rem;">-</span>'}
                    </td>
                    <td style="padding: 0.875rem 1rem; text-align: center; white-space: nowrap;">
                      ${priceExceedsThreshold ? `
                        <span class="badge bg-danger">⚠ Exceeds</span>
                      ` : cheapest ? `
                        <span class="badge bg-success">✓ Good</span>
                      ` : `
                        <span class="badge bg-secondary">Pending</span>
                      `}
                    </td>
                  </tr>
                `;
              })
            ]).join('')}
          </tbody>
        </table>
      </div>
    </div>
    
    ${filteredSummary.length === 0 ? `
      <div class="card" style="padding: 2rem; text-align: center; color: #6b7280;">
        No items match the current filters
      </div>
    ` : ''}
  `;
}

function renderSupplierTab(supplier) {
  if (!rfq || !summary) return '';
  
  let supplierQuotes = summary.map(item => {
    const quote = item.quotes.find(q => q.supplierId === supplier.id);
    return {
      ...item,
      quote: quote || null
    };
  });
  
  const quotedCount = supplierQuotes.filter(item => item.quote && item.quote.quotedPrice !== null && item.quote.quotedPrice > 0).length;
  
  // Filter to show only winning items if filter is enabled
  if (showWinningOnly[supplier.id]) {
    supplierQuotes = supplierQuotes.filter(item => {
      const cheapest = getCheapestQuote(item.quotes || [], item.forcedSupplierId);
      return cheapest?.supplierId === supplier.id || item.forcedSupplierId === supplier.id;
    });
  }
  
  // Group by category
  const groupedByCategory = supplierQuotes.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {});
  
  return `
    <div class="card" style="padding: 1rem; margin-bottom: 1rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: start; gap: 1rem;">
        <div style="flex: 1;">
          <h2 style="font-size: 1.25rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem;">${supplier.name}</h2>
          <p style="font-size: 0.875rem; color: #4b5563;">${supplier.email}</p>
          <p style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
            ${quotedCount} of ${summary.length} items quoted
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button
            onclick="toggleWinningOnly('${supplier.id}')"
            style="padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 0.5rem; border: none; cursor: pointer; background: ${showWinningOnly[supplier.id] ? '#2563eb' : '#f3f4f6'}; color: ${showWinningOnly[supplier.id] ? 'white' : '#374151'}; font-weight: 500;"
          >
            ${showWinningOnly[supplier.id] ? '✓ Showing Winning Only' : 'Filter: Show Winning Only'}
          </button>
          <button
            onclick="handleCreatePO('${supplier.id}')"
            style="padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 0.5rem; border: none; cursor: pointer; background: #059669; color: white; font-weight: 500;"
            ${creatingPO === supplier.id ? 'disabled' : ''}
          >
            ${creatingPO === supplier.id ? 'Creating PO...' : '📦 Create PO in Cin7'}
          </button>
        </div>
        <div style="width: 100%;">
          <p style="font-size: 0.75rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem;">Supplier Portal Link:</p>
          <div style="display: flex; gap: 0.5rem;">
            <input
              type="text"
              readonly
              value="${getSupplierLink(supplier.uniqueToken)}"
              class="form-control"
            />
            <button
              onclick="copySupplierLink('${supplier.uniqueToken}')"
              class="btn btn-outline-secondary btn-sm text-nowrap"
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="card shadow-sm">
      <div class="table-responsive">
        <table class="table table-sm table-hover mb-0">
          <thead class="table-light">
            <tr>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; position: sticky; left: 0; background: #f9fafb; z-index: 10; min-width: 200px;">Product Name</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 120px;">SKU</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 120px;">MPN</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 120px;">Category</th>
              <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 100px;">Target</th>
              <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 80px;">Qty Needed</th>
              <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 80px;">On Order</th>
              <th style="padding: 0.75rem; text-align: right; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 100px;">Quoted Price</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 120px;">Supplier MPN</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 100px;">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 200px;">Comments</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; min-width: 120px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(groupedByCategory).flatMap(([category, items]) => [
              `<tr class="category-header" style="background: #f3f4f6; border-top: 2px solid #d1d5db; border-bottom: 1px solid #d1d5db;">
                <td colspan="11" style="padding: 0.75rem 1rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="font-weight: 700; font-size: 1.125rem; color: #111827;">${category}</span>
                    <span style="font-size: 0.875rem; color: #4b5563;">(${items.length} ${items.length === 1 ? 'item' : 'items'})</span>
                  </div>
                </td>
              </tr>`,
              ...items.map(item => {
                const quote = item.quote;
                const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0;
                const priceExceedsThreshold = hasQuote && isPriceIncrease(item.targetPrice, quote.quotedPrice);
                
                const cheapest = getCheapestQuote(item.quotes || [], item.forcedSupplierId);
                const isWinning = cheapest?.supplierId === supplier.id || item.forcedSupplierId === supplier.id;
                const isForced = item.forcedSupplierId === supplier.id;
                
                return `
                  <tr style="border-bottom: 1px solid #e5e7eb; ${isWinning ? 'background: rgba(254, 243, 199, 0.5);' : priceExceedsThreshold ? 'background: rgba(254, 226, 226, 0.3);' : hasQuote ? 'background: rgba(219, 234, 254, 0.3);' : ''}">
                    <td style="padding: 0.75rem; font-weight: 500; color: #111827; position: sticky; left: 0; background: white; z-index: 0;">${item.productName}</td>
                    <td style="padding: 0.75rem; color: #4b5563; font-family: monospace; font-size: 0.75rem;">${item.sku}</td>
                    <td style="padding: 0.75rem; color: #4b5563; font-family: monospace; font-size: 0.75rem;">${item.mpn}</td>
                    <td style="padding: 0.75rem; color: #4b5563;">
                      <span style="background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">${item.category}</span>
                    </td>
                    <td style="padding: 0.75rem; text-align: right; color: #374151; font-weight: 500;">£${(item.targetPrice || 0).toFixed(2)}</td>
                    <td style="padding: 0.75rem; text-align: right; color: #374151; font-weight: 500;">${item.quantity}</td>
                    <td style="padding: 0.75rem; text-align: right; color: #4b5563; font-weight: 500;">${item.onOrder > 0 ? item.onOrder : '-'}</td>
                    <td style="padding: 0.75rem; text-align: right; font-weight: 600; ${priceExceedsThreshold ? 'color: #dc2626;' : hasQuote ? 'color: #2563eb;' : 'color: #9ca3af;'}">
                      ${hasQuote ? `£${quote.quotedPrice.toFixed(2)}` : 'Not quoted'}
                    </td>
                    <td style="padding: 0.75rem; color: #4b5563; font-family: monospace; font-size: 0.75rem;">
                      ${hasQuote && quote.supplierMpn ? quote.supplierMpn : '-'}
                    </td>
                    <td style="padding: 0.75rem; text-align: center;">
                      ${isWinning ? `
                        <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: #fef3c7; color: #92400e; font-weight: 700;">
                          ${isForced ? '🔒 Forced' : '🏆 Winning'}
                        </span>
                      ` : priceExceedsThreshold ? `
                        <span class="badge badge-danger">⚠ Exceeds</span>
                      ` : hasQuote ? `
                        <span class="badge badge-success">✓ Quoted</span>
                      ` : `
                        <span class="badge badge-gray">Pending</span>
                      `}
                    </td>
                    <td style="padding: 0.75rem; color: #4b5563; font-size: 0.875rem;">
                      ${hasQuote && quote.comments ? String(quote.comments) : '-'}
                    </td>
                    <td style="padding: 0.75rem; text-align: center;">
                      ${isForced ? `
                        <button
                          onclick="handleOverride('${item.itemId}', null)"
                          style="padding: 0.25rem 0.75rem; font-size: 0.75rem; background: #dc2626; color: white; border-radius: 0.25rem; border: none; cursor: pointer;"
                          ${overridingItem === item.itemId ? 'disabled' : ''}
                          title="Remove override"
                        >
                          ${overridingItem === item.itemId ? '...' : 'Remove Override'}
                        </button>
                      ` : `
                        <button
                          onclick="handleOverride('${item.itemId}', '${supplier.id}')"
                          style="padding: 0.25rem 0.75rem; font-size: 0.75rem; background: #ea580c; color: white; border-radius: 0.25rem; border: none; cursor: pointer;"
                          ${overridingItem === item.itemId || !hasQuote ? 'disabled' : ''}
                          title="Force purchase from this supplier even if price is higher"
                        >
                          ${overridingItem === item.itemId ? '...' : 'Force Override'}
                        </button>
                      `}
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

function renderManageSuppliersTab() {
  if (!rfq) return '';
  
  return `
    <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Add New Supplier</h2>
        <a href="/settings" style="color: #2563eb; font-weight: 500; font-size: 0.875rem; text-decoration: none;">
          ⚙️ Manage Global Suppliers →
        </a>
      </div>
      <form onsubmit="handleAddSupplier(event)" style="display: flex; flex-direction: column; gap: 1rem;">
        ${globalSuppliers.length > 0 ? `
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Or Select from Global Suppliers</label>
            <select
              id="selectedGlobalSupplier"
              onchange="handleGlobalSupplierSelect(this.value)"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            >
              <option value="">Select a global supplier...</option>
              ${globalSuppliers.map(s => `
                <option value="${s.id}">${s.name} (${s.email})</option>
              `).join('')}
            </select>
          </div>
        ` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Supplier Name</label>
            <input
              type="text"
              id="newSupplierName"
              placeholder="Enter supplier name"
              required
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Supplier Email</label>
            <input
              type="email"
              id="newSupplierEmail"
              placeholder="supplier@example.com"
              required
              class="form-control"
            />
          </div>
        </div>
        <button
          type="submit"
          id="addSupplierBtn"
          class="btn btn-primary"
        >
          + Add Supplier
        </button>
      </form>
    </div>

    <div class="d-flex flex-column gap-3">
      ${rfq.suppliers.map(supplier => `
        <div class="card shadow-sm">
          <div class="card-body">
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3">
              <div>
                <h3 class="h6 fw-bold mb-1">${supplier.name}</h3>
                <p class="text-muted small mb-0">${supplier.email}</p>
              </div>
              <div class="w-100">
                <label class="form-label small fw-semibold mb-1">Supplier Portal Link:</label>
                <div class="input-group input-group-sm">
                  <input
                    type="text"
                    readonly
                    value="${getSupplierLink(supplier.uniqueToken)}"
                    class="form-control"
                />
                <button
                  onclick="copySupplierLink('${supplier.uniqueToken}')"
                  class="btn btn-outline-secondary btn-sm text-nowrap"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Helper functions
function getSupplierLink(token) {
  return `${window.location.origin}/supplier/${token}`;
}

function copySupplierLink(token) {
  navigator.clipboard.writeText(getSupplierLink(token));
  alert('Link copied to clipboard!');
}

function handleSort(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  renderTabContent();
}

// Column filter function removed - filters no longer in column headers

function toggleNoQuotes() {
  showNoQuotes = !showNoQuotes;
  renderTabContent();
}

function toggleExceedsThreshold() {
  showExceedsThreshold = !showExceedsThreshold;
  renderTabContent();
}

function toggleWinningOnly(supplierId) {
  showWinningOnly[supplierId] = !showWinningOnly[supplierId];
  renderTabContent();
}

function handleQuantityChange(itemId, newQuantity) {
  editingQuantity[itemId] = newQuantity;
  renderTabContent();
}

async function handleQuantityBlur(itemId) {
  const newQuantity = editingQuantity[itemId];
  if (newQuantity === undefined) return;
  
  const item = summary.find(i => i.itemId === itemId);
  if (!item || parseInt(newQuantity) === item.quantity) {
    delete editingQuantity[itemId];
    renderTabContent();
    return;
  }
  
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  updatingQuantity = itemId;
  renderTabContent();
  
  try {
    const response = await fetch(`/api/rfq/${rfqId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: parseInt(newQuantity) })
    });
    
    if (response.ok) {
      await fetchSummary(rfqId);
      delete editingQuantity[itemId];
    }
  } catch (error) {
    console.error('Error updating quantity:', error);
  } finally {
    updatingQuantity = null;
    renderTabContent();
  }
}

function handleQuantityKeyDown(e, itemId) {
  if (e.key === 'Enter') {
    e.target.blur();
  } else if (e.key === 'Escape') {
    delete editingQuantity[itemId];
    renderTabContent();
    e.target.blur();
  }
}

async function handleAddSupplier(e) {
  e.preventDefault();
  
  const name = document.getElementById('newSupplierName').value;
  const email = document.getElementById('newSupplierEmail').value;
  const selectedGlobalSupplier = document.getElementById('selectedGlobalSupplier')?.value;
  
  let finalName = name;
  let finalEmail = email;
  
  if (selectedGlobalSupplier) {
    const globalSupplier = globalSuppliers.find(s => s.id === selectedGlobalSupplier);
    if (globalSupplier) {
      finalName = globalSupplier.name;
      finalEmail = globalSupplier.email;
    }
  }
  
  if (!finalName || !finalEmail) return;
  
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  const btn = document.getElementById('addSupplierBtn');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';
  }
  
  try {
    const response = await fetch(`/api/rfq/${rfqId}/supplier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: finalName,
        email: finalEmail,
      })
    });
    
    if (response.ok) {
      document.getElementById('newSupplierName').value = '';
      document.getElementById('newSupplierEmail').value = '';
      if (document.getElementById('selectedGlobalSupplier')) {
        document.getElementById('selectedGlobalSupplier').value = '';
      }
      await fetchRFQ(rfqId);
      setActiveTab('summary');
    }
  } catch (error) {
    console.error('Error adding supplier:', error);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '+ Add Supplier';
    }
  }
}

function handleGlobalSupplierSelect(supplierId) {
  if (!supplierId) return;
  const globalSupplier = globalSuppliers.find(s => s.id === supplierId);
  if (globalSupplier) {
    document.getElementById('newSupplierName').value = globalSupplier.name;
    document.getElementById('newSupplierEmail').value = globalSupplier.email;
  }
}

async function handleOverride(itemId, supplierId) {
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  overridingItem = itemId;
  renderTabContent();
  
  try {
    const response = await fetch(`/api/rfq/${rfqId}/items/${itemId}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forcedSupplierId: supplierId })
    });
    
    if (response.ok) {
      await fetchSummary(rfqId);
    } else {
      const error = await response.json();
      alert(`Failed to set override: ${error.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error setting override:', error);
    alert('Failed to set override. Please try again.');
  } finally {
    overridingItem = null;
    renderTabContent();
  }
}

async function handleCreatePO(supplierId) {
  if (!confirm('Create Purchase Order in Cin7 for all winning items for this supplier?')) {
    return;
  }
  
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  creatingPO = supplierId;
  renderTabContent();
  
  try {
    const response = await fetch(`/api/rfq/${rfqId}/supplier/${supplierId}/create-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(`Purchase Order ${data.orderNumber} created successfully!\\n\\n${data.itemCount} items added to PO.`);
    } else {
      alert(`Failed to create PO: ${data.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error creating PO:', error);
    alert('Failed to create Purchase Order. Please try again.');
  } finally {
    creatingPO = null;
    renderTabContent();
  }
}

function exportCSV() {
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  const exportData = summary.map(item => {
    const cheapest = getCheapestQuote(item.quotes);
    return {
      SKU: item.sku,
      'Product Name': item.productName,
      MPN: item.mpn,
      Category: item.category,
      'Quantity Needed': item.quantity,
      'On Order': item.onOrder || 0,
      'Target Price': `£${item.targetPrice.toFixed(2)}`,
      'Selected Supplier': cheapest?.supplierName || '',
      'Selected Price': cheapest?.quotedPrice ? `£${cheapest.quotedPrice.toFixed(2)}` : '',
      'Selected MPN': cheapest?.supplierMpn || '',
      'Supplier Comments': cheapest?.comments || '',
    };
  });
  
  // Simple CSV conversion
  const headers = Object.keys(exportData[0] || {});
  const csvRows = [
    headers.join(','),
    ...exportData.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];
  
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rfq-export-${rfqId}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Auto-size columns based on content
function autoSizeColumns(table) {
  const headers = table.querySelectorAll('th[data-column]');
  const rows = table.querySelectorAll('tbody tr');
  
  headers.forEach((header, colIndex) => {
    let maxWidth = 0;
    const minWidth = parseInt(header.style.minWidth) || 100;
    
    // Check header width
    const headerContent = header.querySelector('.th-content');
    if (headerContent) {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.whiteSpace = 'nowrap';
      tempDiv.style.padding = '0.875rem 1rem';
      tempDiv.style.fontSize = window.getComputedStyle(header).fontSize;
      tempDiv.style.fontFamily = window.getComputedStyle(header).fontFamily;
      tempDiv.innerHTML = headerContent.innerHTML;
      document.body.appendChild(tempDiv);
      maxWidth = Math.max(maxWidth, tempDiv.offsetWidth);
      document.body.removeChild(tempDiv);
    }
    
    // Check all cells in this column
    rows.forEach(row => {
      const cell = row.children[colIndex];
      if (cell) {
        const cellText = cell.textContent || cell.innerText;
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.whiteSpace = 'nowrap';
        tempDiv.style.padding = '0.875rem 1rem';
        tempDiv.style.fontSize = window.getComputedStyle(cell).fontSize;
        tempDiv.style.fontFamily = window.getComputedStyle(cell).fontFamily;
        tempDiv.textContent = cellText;
        document.body.appendChild(tempDiv);
        maxWidth = Math.max(maxWidth, tempDiv.offsetWidth + 20); // Add padding
        document.body.removeChild(tempDiv);
      }
    });
    
    // Set width to max content width or minimum
    const finalWidth = Math.max(minWidth, maxWidth);
    header.style.width = finalWidth + 'px';
    
    // Update all cells in this column
    rows.forEach(row => {
      const cell = row.children[colIndex];
      if (cell) {
        cell.style.width = finalWidth + 'px';
      }
    });
  });
}

// Initialize column resizing after table is rendered
function initColumnResizing() {
  const table = document.querySelector('.resizable-table');
  if (!table) return;
  
  // First, auto-size columns based on content
  autoSizeColumns(table);
  
  const headers = table.querySelectorAll('th[data-column]');
  let isResizing = false;
  let currentHeader = null;
  let startX = 0;
  let startWidth = 0;
  
  headers.forEach(header => {
    const handle = header.querySelector('.resize-handle');
    if (!handle) return;
    
    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      currentHeader = header;
      startX = e.pageX;
      startWidth = header.offsetWidth;
      header.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
      e.stopPropagation();
    });
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isResizing || !currentHeader) return;
    
    const diff = e.pageX - startX;
    const minWidth = parseInt(currentHeader.style.minWidth) || 100;
    const newWidth = Math.max(minWidth, startWidth + diff);
    currentHeader.style.width = newWidth + 'px';
    
    // Update all cells in this column
    const columnIndex = Array.from(currentHeader.parentElement.children).indexOf(currentHeader);
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cell = row.children[columnIndex];
      if (cell) {
        cell.style.width = newWidth + 'px';
      }
    });
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing && currentHeader) {
      currentHeader.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      isResizing = false;
      currentHeader = null;
    }
  });
}

// Delete RFQ function
async function deleteRFQ() {
  if (!rfq) return;
  
  const confirmed = confirm(
    `Are you sure you want to delete "${rfq.name}"?\\n\\nThis will permanently delete:\\n- All RFQ items\\n- All supplier quotes\\n- All supplier links\\n\\nThis action cannot be undone.`
  );
  
  if (!confirmed) return;
  
  const pathParts = window.location.pathname.split('/');
  const rfqId = pathParts[pathParts.length - 1];
  
  try {
    const response = await fetch(`/api/rfq/${rfqId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      window.location.href = '/';
    } else {
      const error = await response.json();
      alert(`Failed to delete RFQ: ${error.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error deleting RFQ:', error);
    alert('Failed to delete RFQ. Please try again.');
  }
}
