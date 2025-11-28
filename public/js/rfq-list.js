// Simple RFQ list page
async function fetchRFQs() {
  try {
    const response = await fetch('/api/rfq/list');
    const data = await response.json();
    displayRFQs(data);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('empty').style.display = 'block';
  }
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
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '1.5rem';
    card.style.marginBottom = '1rem';
    card.style.cursor = 'pointer';
    card.onclick = () => window.location.href = `/rfq/${rfq.id}`;
    
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${rfq.name}</h2>
          <p style="font-size: 0.875rem; color: #6b7280;">
            Created: ${new Date(rfq.createdAt).toLocaleDateString()} • 
            ${rfq.itemCount} items • ${rfq.supplierCount} suppliers
          </p>
        </div>
        <span style="color: #2563eb;">View →</span>
      </div>
    `;
    
    rfqList.appendChild(card);
  });
}

document.addEventListener('DOMContentLoaded', fetchRFQs);

