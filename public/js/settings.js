// Settings page - Full implementation
let suppliers = [];
let loading = true;
let dearConfig = null;
let exclusionPatterns = [];
let categoryExclusionPatterns = [];
let dearSuppliers = [];
let dearCategories = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Fetch all data first, then render once
  await Promise.all([
    fetchSuppliers(),
    fetchDearConfig(),
    fetchExclusionPatterns(),
    fetchCategoryExclusionPatterns()
  ]);
  
  // Render after all data is loaded
  loading = false;
  renderSettings();
});

async function fetchSuppliers() {
  try {
    const response = await fetch('/api/settings/suppliers');
    const data = await response.json();
    suppliers = data;
  } catch (error) {
    console.error('Error fetching suppliers:', error);
  }
}

async function fetchDearConfig() {
  try {
    const response = await fetch('/api/settings/dear-inventory');
    const data = await response.json();
    if (data.config) {
      dearConfig = data.config;
    }
    // Don't try to set values here - renderSettings will handle it
  } catch (error) {
    console.error('Error fetching Dear Inventory config:', error);
  }
}

async function fetchExclusionPatterns() {
  try {
    const response = await fetch('/api/settings/sku-exclusions');
    const data = await response.json();
    exclusionPatterns = data;
  } catch (error) {
    console.error('Error fetching exclusion patterns:', error);
  }
}

async function fetchCategoryExclusionPatterns() {
  try {
    const response = await fetch('/api/settings/category-exclusions');
    const data = await response.json();
    categoryExclusionPatterns = data;
  } catch (error) {
    console.error('Error fetching category exclusion patterns:', error);
  }
}

function renderSettings() {
  const content = document.getElementById('content');
  const loadingDiv = document.getElementById('loading');
  
  if (!content) return;
  
  if (loading) {
    if (loadingDiv) loadingDiv.classList.remove('d-none');
    content.classList.add('d-none');
    return;
  }
  
  // Hide loading, show content
  if (loadingDiv) loadingDiv.classList.add('d-none');
  content.classList.remove('d-none');
  
  content.innerHTML = `
    <!-- Dear Inventory Configuration -->
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h2 class="h5 fw-bold mb-0">Dear Inventory (Cin7) API Configuration</h2>
          ${dearConfig ? `
            <button
              onclick="handleDeleteConfig()"
              class="btn btn-link text-danger p-0"
            >
              Remove Configuration
            </button>
          ` : ''}
        </div>
        <p class="text-muted mb-3">
          Connect to your Dear Inventory account to automatically sync products and suppliers.
        </p>
        <form onsubmit="handleSaveConfig(event)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Account ID</label>
                <input
                  type="text"
                  id="configAccountId"
                  value="${dearConfig ? (dearConfig.accountId || '') : ''}"
                  placeholder="Your Dear Inventory Account ID"
                  required
                  style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
                />
              </div>
              <div>
                <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Application Key</label>
                <input
                  type="password"
                  id="configApplicationKey"
                  placeholder="Your Dear Inventory Application Key"
                  required
                  style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
                />
              </div>
            </div>
            <div>
              <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Base URL</label>
              <input
                type="text"
                id="configBaseUrl"
                value="${dearConfig ? (dearConfig.baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2') : 'https://inventory.dearsystems.com/ExternalApi/v2'}"
                placeholder="https://inventory.dearsystems.com/ExternalApi/v2"
                style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
              />
            </div>
        ${dearConfig ? `
          <div style="padding: 0.75rem; background: #dbeafe; border-left: 4px solid #2563eb; border-radius: 0.25rem;">
            <p style="font-size: 0.875rem; color: #1e40af;">
              <strong>Status:</strong> Connected
              ${dearConfig.lastSupplierSync ? `
                <span style="margin-left: 1rem;">
                  Last supplier sync: ${new Date(dearConfig.lastSupplierSync).toLocaleString()}
                </span>
              ` : ''}
            </p>
          </div>
        ` : ''}
        <div id="configError" style="display: none; padding: 0.75rem; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 0.25rem;">
          <p style="font-size: 0.875rem; color: #991b1b;"></p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button
            type="button"
            onclick="handleTestConnection()"
            id="testConnectionBtn"
            style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
          >
            Test Connection
          </button>
          <button
            type="submit"
            id="saveConfigBtn"
            style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
          >
            Save Configuration
          </button>
        </div>
      </form>
    </div>

    <!-- Supplier Sync -->
    ${dearConfig ? `
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem;">Sync Suppliers from Dear Inventory</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Sync Strategy</label>
            <select
              id="syncStrategy"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            >
              <option value="merge">Merge (Recommended) - Keep manual, update existing, add new</option>
              <option value="replace">Replace All - Delete all and import from Dear Inventory</option>
              <option value="supplement">Supplement Only - Only add new suppliers</option>
            </select>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <input
              type="checkbox"
              id="onlyActive"
              checked
              style="width: 1rem; height: 1rem;"
            />
            <label for="onlyActive" style="font-size: 0.875rem; color: #374151;">
              Only sync active suppliers
            </label>
          </div>
          <div id="syncResults" style="display: none; padding: 0.75rem; background: #d1fae5; border-left: 4px solid #059669; border-radius: 0.25rem;">
            <p style="font-size: 0.875rem; color: #065f46;"></p>
          </div>
          <button
            onclick="handleSyncSuppliers()"
            id="syncSuppliersBtn"
            style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
          >
            Sync Suppliers from Dear Inventory
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Add New Supplier -->
    <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827;">Add New Supplier</h2>
        ${suppliers.length > 0 ? `
          <button
            onclick="handleDeleteAllSuppliers()"
            style="font-size: 0.875rem; color: #dc2626; font-weight: 500; padding: 0.25rem 0.75rem; border: 1px solid #fca5a5; border-radius: 0.25rem; background: white; cursor: pointer;"
          >
            Delete All Suppliers
          </button>
        ` : ''}
      </div>
      <form onsubmit="handleAddSupplier(event)" style="display: flex; flex-direction: column; gap: 1rem;">
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
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
          </div>
        </div>
        <div id="supplierError" style="display: none; padding: 0.75rem; background: #fee2e2; border-left: 4px solid #dc2626; border-radius: 0.25rem;">
          <p style="font-size: 0.875rem; color: #991b1b;"></p>
        </div>
        <button
          type="submit"
          id="addSupplierBtn"
          style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
        >
          + Add Supplier
        </button>
      </form>
    </div>

    <!-- Add Individual Supplier from Dear Inventory -->
    ${dearConfig ? `
      <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
        <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem;">Add Supplier from Dear Inventory</h2>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <button
            onclick="handleLoadDearSuppliers()"
            id="loadDearSuppliersBtn"
            style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
          >
            Load Suppliers from Dear Inventory
          </button>

          <div id="dearSuppliersSection" style="display: none;">
            <div>
              <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Select Supplier to Add
              </label>
              <select
                id="selectedDearSupplier"
                style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
              >
                <option value="">-- Select a supplier --</option>
              </select>
            </div>
            <button
              onclick="handleAddSelectedSupplier()"
              id="addSelectedSupplierBtn"
              style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
            >
              Add Selected Supplier
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- SKU Exclusion Patterns -->
    <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem;">SKU Exclusion Patterns</h2>
      <p style="font-size: 0.875rem; color: #4b5563; margin-bottom: 1rem;">
        Exclude products from RFQs based on SKU patterns. Use <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">*</code> as a wildcard.
        <br />
        Examples: <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">BT_W2F_*</code> excludes all SKUs starting with "BT_W2F_",
        <code style="background: #f3f4f6; padding: 0.125rem 0.25rem; border-radius: 0.25rem;">SYS_*</code> excludes all system SKUs.
      </p>
      
      <form onsubmit="handleAddExclusionPattern(event)" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Pattern (e.g., BT_W2F_*)
            </label>
            <input
              type="text"
              id="newPattern"
              placeholder="BT_W2F_*"
              required
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Description (Optional)
            </label>
            <input
              type="text"
              id="newPatternDescription"
              placeholder="Exclude Bluetooth products"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
          </div>
        </div>
        <button
          type="submit"
          id="addPatternBtn"
          style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
        >
          + Add Exclusion Pattern
        </button>
      </form>

      ${exclusionPatterns.length > 0 ? `
        <div style="overflow-x: auto;">
          <table style="width: 100%; font-size: 0.875rem;">
            <thead style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <tr>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Pattern</th>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Description</th>
                <th style="padding: 0.75rem 1rem; text-align: right; font-weight: 600; color: #374151;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${exclusionPatterns.map(pattern => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 0.75rem 1rem; font-family: monospace; color: #111827;">${pattern.pattern}</td>
                  <td style="padding: 0.75rem 1rem; color: #4b5563;">${pattern.description || '-'}</td>
                  <td style="padding: 0.75rem 1rem; text-align: right;">
                    <button
                      onclick="handleDeleteExclusionPattern('${pattern.id}')"
                      style="color: #dc2626; font-weight: 500; font-size: 0.875rem; border: none; background: none; cursor: pointer;"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <p style="color: #6b7280; text-align: center; padding: 2rem;">No exclusion patterns added yet.</p>
      `}
    </div>

    <!-- Category Exclusion Patterns -->
    <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem;">Category Exclusion Patterns</h2>
      <p style="font-size: 0.875rem; color: #4b5563; margin-bottom: 1rem;">
        Exclude products from RFQs based on categories from Dear Inventory. Select categories from the dropdown or enter a custom pattern with wildcards.
      </p>
      
      ${dearConfig ? `
        <div style="margin-bottom: 1rem;">
          <button
            onclick="handleLoadCategories()"
            id="loadCategoriesBtn"
            style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500; margin-bottom: 1rem;"
          >
            Load Categories from Dear Inventory
          </button>
        </div>
      ` : ''}

      <form onsubmit="handleAddCategoryExclusionPattern(event)" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        ${dearCategories.length > 0 ? `
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Select Category to Exclude
            </label>
            <select
              id="selectedCategory"
              onchange="handleCategorySelect(this.value)"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            >
              <option value="">-- Select a category --</option>
              ${dearCategories.map(category => `
                <option value="${category.name}" ${category.isExcluded ? 'disabled' : ''}>
                  ${category.name} ${category.isExcluded ? '✓ Already Excluded' : ''}
                </option>
              `).join('')}
            </select>
            <p style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">Or enter a custom pattern below</p>
          </div>
        ` : ''}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              ${dearCategories.length > 0 ? 'Custom Pattern (Optional)' : 'Category Pattern'}
            </label>
            <input
              type="text"
              id="newCategoryPattern"
              oninput="handleCategoryPatternInput(this.value)"
              placeholder="${dearCategories.length > 0 ? 'Or enter custom pattern (e.g., Test*)' : 'Enter category name or pattern (e.g., Test*)'}"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
            ${dearCategories.length > 0 ? `
              <p style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">Use wildcards like * for pattern matching</p>
            ` : ''}
          </div>
          <div>
            <label style="display: block; font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Description (Optional)
            </label>
            <input
              type="text"
              id="newCategoryPatternDescription"
              placeholder="Exclude test categories"
              style="width: 100%; padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem;"
            />
          </div>
        </div>
        <button
          type="submit"
          id="addCategoryPatternBtn"
          style="padding: 0.5rem 1rem; background: #2563eb; color: white; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 500;"
        >
          + Add Exclusion Pattern
        </button>
      </form>

      ${categoryExclusionPatterns.length > 0 ? `
        <div style="overflow-x: auto;">
          <table style="width: 100%; font-size: 0.875rem;">
            <thead style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <tr>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Pattern</th>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Description</th>
                <th style="padding: 0.75rem 1rem; text-align: right; font-weight: 600; color: #374151;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${categoryExclusionPatterns.map(pattern => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 0.75rem 1rem; font-family: monospace; color: #111827;">${pattern.pattern}</td>
                  <td style="padding: 0.75rem 1rem; color: #4b5563;">${pattern.description || '-'}</td>
                  <td style="padding: 0.75rem 1rem; text-align: right;">
                    <button
                      onclick="handleDeleteCategoryExclusionPattern('${pattern.id}')"
                      style="color: #dc2626; font-weight: 500; font-size: 0.875rem; border: none; background: none; cursor: pointer;"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <p style="color: #6b7280; text-align: center; padding: 2rem;">No exclusion patterns added yet.</p>
      `}
    </div>

    <!-- Global Suppliers List -->
    <div class="card" style="padding: 1.5rem;">
      <h2 style="font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 1rem;">Global Suppliers</h2>
      ${suppliers.length === 0 ? `
        <p style="color: #6b7280; text-align: center; padding: 2rem;">No suppliers added yet. Add one above to get started.</p>
      ` : `
        <div style="overflow-x: auto;">
          <table style="width: 100%; font-size: 0.875rem;">
            <thead style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <tr>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Name</th>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Email</th>
                <th style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151;">Source</th>
                <th style="padding: 0.75rem 1rem; text-align: right; font-weight: 600; color: #374151;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${suppliers.map(supplier => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 0.75rem 1rem; font-weight: 500; color: #111827;">${supplier.name}</td>
                  <td style="padding: 0.75rem 1rem; color: #4b5563;">${supplier.email}</td>
                  <td style="padding: 0.75rem 1rem;">
                    ${supplier.syncedFromDear ? `
                      <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: #dbeafe; color: #1e40af;">
                        Dear Inventory
                      </span>
                    ` : `
                      <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.625rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background: #f3f4f6; color: #1f2937;">
                        Manual
                      </span>
                    `}
                  </td>
                  <td style="padding: 0.75rem 1rem; text-align: right;">
                    <button
                      onclick="handleDeleteSupplier('${supplier.id}')"
                      style="color: #dc2626; font-weight: 500; font-size: 0.875rem; border: none; background: none; cursor: pointer;"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// Event handlers
async function handleSaveConfig(e) {
  e.preventDefault();
  
  const accountId = document.getElementById('configAccountId').value;
  const applicationKey = document.getElementById('configApplicationKey').value;
  const baseUrl = document.getElementById('configBaseUrl').value || 'https://inventory.dearsystems.com/ExternalApi/v2';
  
  if (!accountId || !applicationKey) {
    showConfigError('Account ID and Application Key are required');
    return;
  }
  
  const btn = document.getElementById('saveConfigBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }
  
  try {
    const response = await fetch('/api/settings/dear-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        applicationKey,
        baseUrl,
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to save configuration');
    }
    
    document.getElementById('configApplicationKey').value = '';
    await fetchDearConfig();
    hideConfigError();
  } catch (err) {
    showConfigError(err.message || 'Failed to save configuration');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save Configuration';
    }
  }
}

async function handleTestConnection() {
  const accountId = document.getElementById('configAccountId').value;
  const applicationKey = document.getElementById('configApplicationKey').value;
  const baseUrl = document.getElementById('configBaseUrl').value || 'https://inventory.dearsystems.com/ExternalApi/v2';
  
  if (!accountId || !applicationKey) {
    showConfigError('Please enter Account ID and Application Key first');
    return;
  }
  
  const btn = document.getElementById('testConnectionBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Testing...';
  }
  
  try {
    const response = await fetch('/api/settings/dear-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId,
        applicationKey,
        baseUrl,
      })
    });
    
    const data = await response.json();
    if (response.ok) {
      hideConfigError();
      alert('Connection successful! Configuration saved.');
      document.getElementById('configApplicationKey').value = '';
      await fetchDearConfig();
    } else {
      throw new Error(data.message || 'Connection failed');
    }
  } catch (err) {
    showConfigError(err.message || 'Connection test failed');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Test Connection';
    }
  }
}

async function handleSyncSuppliers() {
  if (!dearConfig) {
    showConfigError('Please configure Dear Inventory API first');
    return;
  }
  
  const strategy = document.getElementById('syncStrategy').value;
  const onlyActive = document.getElementById('onlyActive').checked;
  
  const btn = document.getElementById('syncSuppliersBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Syncing...';
  }
  
  try {
    const response = await fetch('/api/settings/suppliers/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategy,
        onlyActive,
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to sync suppliers');
    }
    
    const resultsDiv = document.getElementById('syncResults');
    if (resultsDiv) {
      resultsDiv.style.display = 'block';
      resultsDiv.querySelector('p').textContent = 
        `Sync Complete: Added ${data.results.added}, Updated ${data.results.updated}, Skipped ${data.results.skipped}`;
    }
    
    await fetchSuppliers();
    await fetchDearConfig();
  } catch (err) {
    showConfigError(err.message || 'Failed to sync suppliers');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Sync Suppliers from Dear Inventory';
    }
  }
}

async function handleAddSupplier(e) {
  e.preventDefault();
  
  const name = document.getElementById('newSupplierName').value;
  const email = document.getElementById('newSupplierEmail').value;
  
  if (!name || !email) {
    showSupplierError('Please provide both name and email');
    return;
  }
  
  const btn = document.getElementById('addSupplierBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }
  
  try {
    const response = await fetch('/api/settings/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add supplier');
    }
    
    document.getElementById('newSupplierName').value = '';
    document.getElementById('newSupplierEmail').value = '';
    await fetchSuppliers();
    hideSupplierError();
  } catch (err) {
    showSupplierError(err.message || 'Failed to add supplier');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '+ Add Supplier';
    }
  }
}

async function handleDeleteSupplier(id) {
  if (!confirm('Are you sure you want to delete this supplier?')) return;
  
  try {
    const response = await fetch(`/api/settings/suppliers/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await fetchSuppliers();
    }
  } catch (error) {
    console.error('Error deleting supplier:', error);
  }
}

async function handleDeleteAllSuppliers() {
  if (!confirm('Are you sure you want to delete ALL global suppliers? This action cannot be undone.')) return;
  
  try {
    const response = await fetch('/api/settings/suppliers', {
      method: 'DELETE'
    });
    
    if (response.ok) {
      const data = await response.json();
      alert(`Successfully deleted ${data.deletedCount} supplier(s)`);
      await fetchSuppliers();
    } else {
      const error = await response.json();
      showSupplierError(error.message || 'Failed to delete all suppliers');
    }
  } catch (error) {
    console.error('Error deleting all suppliers:', error);
    showSupplierError('Failed to delete all suppliers');
  }
}

async function handleLoadDearSuppliers() {
  if (!dearConfig) {
    showConfigError('Please configure Dear Inventory API first');
    return;
  }
  
  const btn = document.getElementById('loadDearSuppliersBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
  }
  
  try {
    const response = await fetch('/api/settings/suppliers/dear');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch suppliers');
    }
    
    dearSuppliers = data.suppliers || [];
    const section = document.getElementById('dearSuppliersSection');
    const select = document.getElementById('selectedDearSupplier');
    
    if (section && select) {
      section.style.display = 'block';
      select.innerHTML = '<option value="">-- Select a supplier --</option>' +
        dearSuppliers.map(s => `
          <option value="${s.id}" ${s.alreadyAdded ? 'disabled' : ''}>
            ${s.name} ${s.email ? `(${s.email})` : '(No email)'} ${s.alreadyAdded ? '✓ Already Added' : ''}
          </option>
        `).join('');
    }
  } catch (err) {
    showConfigError(err.message || 'Failed to fetch suppliers from Dear Inventory');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Load Suppliers from Dear Inventory';
    }
  }
}

async function handleAddSelectedSupplier() {
  const selectedId = document.getElementById('selectedDearSupplier').value;
  
  if (!selectedId) {
    showSupplierError('Please select a supplier');
    return;
  }
  
  const supplier = dearSuppliers.find(s => s.id === selectedId);
  if (!supplier) {
    showSupplierError('Selected supplier not found');
    return;
  }
  
  if (supplier.alreadyAdded) {
    showSupplierError('This supplier is already added');
    return;
  }
  
  if (!supplier.email) {
    showSupplierError('Selected supplier has no email address');
    return;
  }
  
  const btn = document.getElementById('addSelectedSupplierBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }
  
  try {
    const response = await fetch('/api/settings/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: supplier.name,
        email: supplier.email,
        dearSupplierId: supplier.id,
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add supplier');
    }
    
    document.getElementById('selectedDearSupplier').value = '';
    await fetchSuppliers();
    await handleLoadDearSuppliers();
    hideSupplierError();
  } catch (err) {
    showSupplierError(err.message || 'Failed to add supplier');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Add Selected Supplier';
    }
  }
}

async function handleAddExclusionPattern(e) {
  e.preventDefault();
  
  const pattern = document.getElementById('newPattern').value.trim();
  const description = document.getElementById('newPatternDescription').value.trim();
  
  if (!pattern) {
    showSupplierError('Please enter a pattern');
    return;
  }
  
  const btn = document.getElementById('addPatternBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }
  
  try {
    const response = await fetch('/api/settings/sku-exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern,
        description: description || null,
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add exclusion pattern');
    }
    
    document.getElementById('newPattern').value = '';
    document.getElementById('newPatternDescription').value = '';
    await fetchExclusionPatterns();
    hideSupplierError();
  } catch (err) {
    showSupplierError(err.message || 'Failed to add exclusion pattern');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '+ Add Exclusion Pattern';
    }
  }
}

async function handleDeleteExclusionPattern(id) {
  if (!confirm('Are you sure you want to delete this exclusion pattern?')) return;
  
  try {
    const response = await fetch(`/api/settings/sku-exclusions/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await fetchExclusionPatterns();
    }
  } catch (error) {
    console.error('Error deleting exclusion pattern:', error);
  }
}

async function handleLoadCategories() {
  if (!dearConfig) {
    showConfigError('Please configure Dear Inventory API first');
    return;
  }
  
  const btn = document.getElementById('loadCategoriesBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Loading...';
  }
  
  try {
    const response = await fetch('/api/settings/categories');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch categories');
    }
    
    dearCategories = data.categories || [];
    renderSettings();
  } catch (err) {
    showConfigError(err.message || 'Failed to fetch categories from Dear Inventory');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Load Categories from Dear Inventory';
    }
  }
}

function handleCategorySelect(value) {
  if (value) {
    document.getElementById('newCategoryPattern').value = '';
  }
}

function handleCategoryPatternInput(value) {
  if (value) {
    document.getElementById('selectedCategory').value = '';
  }
}

async function handleAddCategoryExclusionPattern(e) {
  e.preventDefault();
  
  const selectedCategory = document.getElementById('selectedCategory')?.value || '';
  const categoryPattern = document.getElementById('newCategoryPattern').value.trim();
  const description = document.getElementById('newCategoryPatternDescription').value.trim();
  
  const categoryToAdd = selectedCategory || categoryPattern;
  
  if (!categoryToAdd) {
    showSupplierError('Please select a category or enter a pattern');
    return;
  }
  
  const btn = document.getElementById('addCategoryPatternBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Adding...';
  }
  
  try {
    const response = await fetch('/api/settings/category-exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: categoryToAdd,
        description: description || null,
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add exclusion pattern');
    }
    
    document.getElementById('newCategoryPattern').value = '';
    document.getElementById('newCategoryPatternDescription').value = '';
    if (document.getElementById('selectedCategory')) {
      document.getElementById('selectedCategory').value = '';
    }
    await fetchCategoryExclusionPatterns();
    if (dearCategories.length > 0) {
      await handleLoadCategories();
    }
    hideSupplierError();
  } catch (err) {
    showSupplierError(err.message || 'Failed to add exclusion pattern');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '+ Add Exclusion Pattern';
    }
  }
}

async function handleDeleteCategoryExclusionPattern(id) {
  if (!confirm('Are you sure you want to delete this exclusion pattern?')) return;
  
  try {
    const response = await fetch(`/api/settings/category-exclusions/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await fetchCategoryExclusionPatterns();
    }
  } catch (error) {
    console.error('Error deleting category exclusion pattern:', error);
  }
}

async function handleDeleteConfig() {
  if (!confirm('Are you sure you want to remove Dear Inventory configuration?')) return;
  
  try {
    const response = await fetch('/api/settings/dear-inventory', {
      method: 'DELETE'
    });
    
    if (response.ok) {
      dearConfig = null;
      document.getElementById('configAccountId').value = '';
      document.getElementById('configApplicationKey').value = '';
      document.getElementById('configBaseUrl').value = 'https://inventory.dearsystems.com/ExternalApi/v2';
      renderSettings();
    }
  } catch (error) {
    console.error('Error deleting config:', error);
  }
}

function showConfigError(message) {
  const errorDiv = document.getElementById('configError');
  if (errorDiv) {
    errorDiv.style.display = 'block';
    errorDiv.querySelector('p').textContent = message;
  }
}

function hideConfigError() {
  const errorDiv = document.getElementById('configError');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

function showSupplierError(message) {
  const errorDiv = document.getElementById('supplierError');
  if (errorDiv) {
    errorDiv.style.display = 'block';
    errorDiv.querySelector('p').textContent = message;
  }
}

function hideSupplierError() {
  const errorDiv = document.getElementById('supplierError');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}
