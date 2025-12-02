// Urgent Stock Management Page
let urgentItems = [];
let searchResultsData = [];
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
  loadUrgentItems();
  
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      performSearch();
    }
  });
  
  searchBtn.addEventListener('click', performSearch);
  
  // Clear all button
  document.getElementById('clearAllBtn').addEventListener('click', clearAllUrgentItems);
  
  // Modal confirm button
  document.getElementById('confirmAddBtn').addEventListener('click', confirmAddItem);
});

async function loadUrgentItems() {
  try {
    const response = await fetch('/api/urgent-stock');
    const data = await response.json();
    
    if (data.success) {
      urgentItems = data.items || [];
      renderUrgentList();
    }
  } catch (error) {
    console.error('Error loading urgent items:', error);
    showStatus('error', 'Failed to load urgent stock items');
  }
}

async function performSearch() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput.value.trim();
  
  if (!query) {
    showStatus('warning', 'Please enter a search term');
    return;
  }
  
  const searchBtn = document.getElementById('searchBtn');
  const searchSpinner = document.getElementById('searchSpinner');
  const searchBtnText = document.getElementById('searchBtnText');
  const searchResults = document.getElementById('searchResults');
  
  // Show loading state
  searchBtn.disabled = true;
  searchSpinner.classList.remove('d-none');
  searchBtnText.textContent = 'Searching...';
  searchResults.classList.add('d-none');
  
  try {
    const response = await fetch(`/api/urgent-stock/search?query=${encodeURIComponent(query)}&limit=50`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      searchResultsData = data.products || [];
      renderSearchResults();
      if (searchResultsData.length === 0 && data.message) {
        showStatus('info', data.message);
      }
    } else {
      showStatus('error', data.message || 'Search failed');
    }
  } catch (error) {
    console.error('Error searching:', error);
    showStatus('error', error.message || 'Failed to search inventory. Please check your Dear Inventory configuration in Settings.');
  } finally {
    searchBtn.disabled = false;
    searchSpinner.classList.add('d-none');
    searchBtnText.textContent = 'Search';
  }
}

function renderSearchResults() {
  const searchResults = document.getElementById('searchResults');
  const searchResultsBody = document.getElementById('searchResultsBody');
  
  if (searchResultsData.length === 0) {
    searchResults.classList.add('d-none');
    showStatus('info', 'No products found matching your search');
    return;
  }
  
  searchResults.classList.remove('d-none');
  
  searchResultsBody.innerHTML = searchResultsData.map(product => {
    const isAlreadyAdded = urgentItems.some(item => item.sku === product.sku);
    
    return `
      <tr>
        <td><code>${escapeHtml(product.sku)}</code></td>
        <td>${escapeHtml(product.productName || '')}</td>
        <td>${escapeHtml(product.category || 'Other')}</td>
        <td>${escapeHtml(product.mpn || '')}</td>
        <td class="text-end ${product.available < 0 ? 'text-danger fw-bold' : ''}">${product.available}</td>
        <td class="text-end">${product.onHand}</td>
        <td class="text-end">${product.onOrder}</td>
        <td class="text-end">${product.targetPrice ? `$${product.targetPrice.toFixed(2)}` : '-'}</td>
        <td>
          ${isAlreadyAdded 
            ? '<span class="badge bg-success">Already Added</span>' 
            : `<button class="btn btn-sm btn-danger" onclick="openAddModal(${JSON.stringify(product).replace(/"/g, '&quot;')})">Add to Urgent</button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

function openAddModal(product) {
  // Set modal values
  document.getElementById('modalSku').value = product.sku;
  document.getElementById('modalSkuDisplay').value = product.sku;
  document.getElementById('modalProductName').value = product.productName || '';
  document.getElementById('modalProductNameDisplay').value = product.productName || '';
  document.getElementById('modalCategory').value = product.category || 'Other';
  document.getElementById('modalMpn').value = product.mpn || '';
  document.getElementById('modalTargetPrice').value = product.targetPrice || '';
  document.getElementById('modalDearProductId').value = product.dearProductId || '';
  document.getElementById('modalQuantity').value = Math.max(1, Math.abs(product.available) || 1);
  document.getElementById('modalNotes').value = '';
  document.getElementById('modalRequestedBy').value = '';
  
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
  modal.show();
}

async function confirmAddItem() {
  const confirmBtn = document.getElementById('confirmAddBtn');
  const addSpinner = document.getElementById('addSpinner');
  
  const sku = document.getElementById('modalSku').value;
  const productName = document.getElementById('modalProductName').value;
  const category = document.getElementById('modalCategory').value;
  const mpn = document.getElementById('modalMpn').value;
  const targetPrice = parseFloat(document.getElementById('modalTargetPrice').value) || null;
  const quantity = parseInt(document.getElementById('modalQuantity').value) || 1;
  const notes = document.getElementById('modalNotes').value.trim() || null;
  const requestedBy = document.getElementById('modalRequestedBy').value.trim() || null;
  const dearProductId = document.getElementById('modalDearProductId').value || null;
  
  if (!sku) {
    showStatus('error', 'SKU is required');
    return;
  }
  
  // Show loading state
  confirmBtn.disabled = true;
  addSpinner.classList.remove('d-none');
  
  try {
    const response = await fetch('/api/urgent-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sku,
        productName,
        category,
        mpn,
        targetPrice,
        quantity,
        notes,
        requestedBy,
        dearProductId
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('addItemModal'));
      modal.hide();
      
      // Reload urgent items
      await loadUrgentItems();
      
      // Refresh search results to show "Already Added" badge
      if (searchResultsData && searchResultsData.length > 0) {
        renderSearchResults();
      }
      
      showStatus('success', 'Item added to urgent stock');
    } else {
      showStatus('error', data.message || 'Failed to add item');
    }
  } catch (error) {
    console.error('Error adding item:', error);
    showStatus('error', 'Failed to add item to urgent stock');
  } finally {
    confirmBtn.disabled = false;
    addSpinner.classList.add('d-none');
  }
}

function renderUrgentList() {
  const urgentList = document.getElementById('urgentList');
  const urgentListEmpty = document.getElementById('urgentListEmpty');
  const urgentListBody = document.getElementById('urgentListBody');
  const urgentCount = document.getElementById('urgentCount');
  const clearAllBtn = document.getElementById('clearAllBtn');
  
  urgentCount.textContent = `${urgentItems.length} item${urgentItems.length !== 1 ? 's' : ''}`;
  clearAllBtn.disabled = urgentItems.length === 0;
  
  if (urgentItems.length === 0) {
    urgentList.classList.add('d-none');
    urgentListEmpty.classList.remove('d-none');
    return;
  }
  
  urgentList.classList.remove('d-none');
  urgentListEmpty.classList.add('d-none');
  
  urgentListBody.innerHTML = urgentItems.map(item => `
    <tr class="table-danger">
      <td><code>${escapeHtml(item.sku)}</code></td>
      <td>${escapeHtml(item.productName || '')}</td>
      <td>${escapeHtml(item.category || 'Other')}</td>
      <td>${escapeHtml(item.mpn || '')}</td>
      <td class="text-end fw-bold">${item.quantity}</td>
      <td class="text-end">${item.targetPrice ? `$${item.targetPrice.toFixed(2)}` : '-'}</td>
      <td>${escapeHtml(item.notes || '')}</td>
      <td>${escapeHtml(item.requestedBy || '')}</td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="removeUrgentItem('${item.id}')">
          Remove
        </button>
      </td>
    </tr>
  `).join('');
}

async function removeUrgentItem(id) {
  if (!confirm('Are you sure you want to remove this item from urgent stock?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/urgent-stock/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadUrgentItems();
      
      // Refresh search results if visible
      if (searchResultsData && searchResultsData.length > 0) {
        renderSearchResults();
      }
      
      showStatus('success', 'Item removed from urgent stock');
    } else {
      showStatus('error', data.message || 'Failed to remove item');
    }
  } catch (error) {
    console.error('Error removing item:', error);
    showStatus('error', 'Failed to remove item');
  }
}

async function clearAllUrgentItems() {
  if (!confirm('Are you sure you want to clear all urgent stock items? This cannot be undone.')) {
    return;
  }
  
  const clearBtn = document.getElementById('clearAllBtn');
  clearBtn.disabled = true;
  clearBtn.textContent = 'Clearing...';
  
  try {
    const response = await fetch('/api/urgent-stock', {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      await loadUrgentItems();
      
      // Refresh search results if visible
      if (searchResultsData && searchResultsData.length > 0) {
        renderSearchResults();
      }
      
      showStatus('success', 'All urgent stock items cleared');
    } else {
      showStatus('error', data.message || 'Failed to clear items');
    }
  } catch (error) {
    console.error('Error clearing items:', error);
    showStatus('error', 'Failed to clear items');
  } finally {
    clearBtn.disabled = false;
    clearBtn.textContent = 'Clear All';
  }
}

function showStatus(type, message) {
  const statusDiv = document.getElementById('searchStatus');
  
  const alertClass = {
    'success': 'alert-success',
    'error': 'alert-danger',
    'warning': 'alert-warning',
    'info': 'alert-info'
  }[type] || 'alert-info';
  
  statusDiv.innerHTML = `<div class="alert ${alertClass} alert-dismissible fade show" role="alert">
    ${escapeHtml(message)}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  </div>`;
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    const alert = statusDiv.querySelector('.alert');
    if (alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }
  }, 5000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.openAddModal = openAddModal;
window.removeUrgentItem = removeUrgentItem;

