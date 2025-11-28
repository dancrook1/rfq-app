// Fetch and display all RFQs
async function fetchAllRFQs() {
  try {
    const response = await fetch('/api/rfq/list');
    const rfqList = await response.json();
    
    // Fetch summary for each RFQ
    const rfqSummaries = await Promise.all(
      rfqList.map(async (rfq) => {
        try {
          const summaryResponse = await fetch(`/api/rfq/${rfq.id}/summary`);
          const summaryData = await summaryResponse.json();
          return {
            ...rfq,
            priceThreshold: summaryData.priceThreshold || 10,
            items: summaryData.summary || []
          };
        } catch (error) {
          return {
            ...rfq,
            priceThreshold: 10,
            items: []
          };
        }
      })
    );
    
    displayRFQs(rfqSummaries);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('empty').style.display = 'block';
  }
}

function getCheapestQuote(quotes) {
  const validQuotes = quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0);
  if (validQuotes.length === 0) return null;
  return validQuotes.reduce((min, q) => 
    (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
  );
}

function isPriceIncrease(targetPrice, quotedPrice, threshold) {
  if (!quotedPrice || targetPrice <= 0) return false;
  const increase = ((quotedPrice - targetPrice) / targetPrice) * 100;
  return increase > threshold;
}

function displayRFQs(rfqs) {
  const loading = document.getElementById('loading');
  const empty = document.getElementById('empty');
  const rfqList = document.getElementById('rfqList');
  
  loading.style.display = 'none';
  
  if (rfqs.length === 0) {
    empty.style.display = 'block';
    return;
  }
  
  rfqList.style.display = 'block';
  rfqList.innerHTML = '';
  
  rfqs.forEach((rfq) => {
    const itemsWithQuotes = rfq.items.filter(item => 
      item.quotes.some(q => q.quotedPrice !== null && q.quotedPrice > 0)
    );
    const totalItems = rfq.items.length;
    const quotedItems = itemsWithQuotes.length;
    
    const rfqCard = document.createElement('div');
    rfqCard.className = 'card shadow-sm mb-4';
    
    rfqCard.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-4">
          <div>
            <a href="/rfq/${rfq.id}" class="text-decoration-none">
              <h2 class="h4 fw-bold mb-2">
                ${rfq.name}
              </h2>
            </a>
            <div class="d-flex align-items-center gap-3 small text-muted mt-2">
              <span>Created: ${new Date(rfq.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>${totalItems} items</span>
              <span>•</span>
              <span>${rfq.supplierCount} suppliers</span>
              <span>•</span>
              <span class="fw-semibold ${quotedItems === totalItems ? 'text-success' : 'text-warning'}">
                ${quotedItems}/${totalItems} quoted
              </span>
            </div>
          </div>
          <a href="/rfq/${rfq.id}" class="btn btn-primary">
            View Details →
          </a>
        </div>
        ${itemsWithQuotes.length > 0 ? generateSummaryTable(itemsWithQuotes, rfq.priceThreshold, rfq.id) : `
          <div class="text-center py-4 text-muted">
            No quotes received yet. Share supplier links to get started.
          </div>
        `}
      </div>
    `;
    
    rfqList.appendChild(rfqCard);
  });
}

function generateSummaryTable(items, priceThreshold, rfqId) {
  const topItems = items.slice(0, 5);
  
  let tableHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-hover">
        <thead class="table-light">
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th>MPN</th>
            <th class="text-end">Target</th>
            <th class="text-end">Best Price</th>
            <th>Supplier</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  topItems.forEach((item) => {
    const cheapest = getCheapestQuote(item.quotes);
    const priceExceeds = cheapest && isPriceIncrease(
      item.targetPrice,
      cheapest.quotedPrice,
      priceThreshold
    );
    
    tableHTML += `
      <tr>
        <td class="fw-semibold">${item.productName}</td>
        <td class="text-muted">${item.sku}</td>
        <td class="text-muted">${item.mpn}</td>
        <td class="text-end">£${(item.targetPrice ?? 0).toFixed(2)}</td>
        <td class="text-end fw-semibold ${priceExceeds ? 'text-danger' : 'text-success'}">
          ${cheapest ? `£${cheapest.quotedPrice.toFixed(2)}` : '-'}
        </td>
        <td class="text-muted">${cheapest?.supplierName || '-'}</td>
        <td class="text-center">
          ${priceExceeds ? 
            '<span class="badge bg-danger">⚠ Exceeds</span>' : 
            cheapest ? 
            '<span class="badge bg-success">✓ Good</span>' : 
            '<span class="badge bg-secondary">Pending</span>'
          }
        </td>
      </tr>
    `;
  });
  
  tableHTML += `
        </tbody>
      </table>
      ${items.length > 5 ? `
        <div class="text-center mt-3">
          <a href="/rfq/${rfqId}" class="text-decoration-none fw-semibold">
            View all ${items.length} items →
          </a>
        </div>
      ` : ''}
    </div>
  `;
  
  return tableHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', fetchAllRFQs);

