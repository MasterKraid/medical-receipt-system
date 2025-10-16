// medical_receipt_system/public/form_logic.js

// --- SHARED STATE VARIABLES ---
let packageData = [];
let customerSearchTimeout;
let currentFormType = 'receipt'; // Default, will be set on initialization
let currentUserRole = 'GENERAL_EMPLOYEE'; // NEW: Store the user's role

/**
 * Initializes all form logic, event listeners, and sets the form type.
 * This is the main entry point called from the EJS templates.
 * @param {'receipt' | 'estimate'} formType - The type of form being initialized.
 */
function initializeFormLogic(formType, userRole) {
    currentFormType = formType;
    currentUserRole = userRole;
    console.log(`Initializing form logic for: ${currentFormType} as role: ${currentUserRole}`);

    // Initialize date pickers
    flatpickr(".flatpickr-date", { dateFormat: "d/m/Y", allowInput: true });
    // Set a default date for the estimate date if it's empty
    if (currentFormType === 'estimate') {
        const estimateDateInput = document.getElementById('estimate_date');
        if (estimateDateInput && !estimateDateInput.value) {
            flatpickr(estimateDateInput).setDate(new Date(), false);
        }
    }

    // Fetch data from the server
    initializeCascadingDropdowns();

    // Add all necessary event listeners
    addGlobalEventListeners();
    addEventListenersToAllRows();
    updateCalculations();

    setCustomerMode('new');

    if (currentUserRole === 'CLIENT') {
        // Apply client-specific classes to initial elements on page load
        document.querySelector('.item-header')?.classList.add('client-view');
        document.querySelector('.item-row')?.classList.add('client-view');
        
        // Set up the toggle switch listener
        const toggle = document.getElementById('b2b-visibility-toggle');
        if (toggle) {
            toggle.addEventListener('change', handleB2BToggle);
            handleB2BToggle(); // Set initial state
        }
    }
}

/**
 * Initializes cascading Lab → Package List dropdowns and package items section.
 */
async function initializeCascadingDropdowns() {
    const labSelect = document.getElementById('lab_selection');
    const listSelect = document.getElementById('package_list_selection');
    const itemsContainer = document.getElementById('items-container');
    const addItemBtn = document.getElementById('add-item-btn');

    function setItemSectionEnabled(isEnabled) {
        itemsContainer.style.opacity = isEnabled ? '1' : '0.5';
        itemsContainer.style.pointerEvents = isEnabled ? 'auto' : 'none';
        addItemBtn.disabled = !isEnabled;
    }

    // Initial state: disable items section
    setItemSectionEnabled(true);
    listSelect.disabled = true;

    // Fetch and populate labs
    try {
        const labResponse = await fetch('/api/user-labs');
        const labs = await labResponse.json();
        labSelect.innerHTML = '<option value="">-- Select a Lab --</option>';
        labs.forEach(lab => labSelect.innerHTML += `<option value="${lab.id}">${lab.name}</option>`);
    } catch (e) {
        console.error("Failed to load labs", e);
    }

    // Lab selection event
    labSelect.addEventListener('change', async () => {
        const labId = labSelect.value;
        listSelect.innerHTML = '<option value="">-- Loading Lists... --</option>';
        packageData = [];
        populateDatalist();
        setItemSectionEnabled(false);

        if (!labId) {
            listSelect.innerHTML = '<option value="">-- Select a Lab First --</option>';
            listSelect.disabled = true;
            return;
        }

        try {
            const listResponse = await fetch(`/api/user-lists-for-lab?labId=${labId}`);
            const lists = await listResponse.json();
            listSelect.innerHTML = lists.length > 0 ? '<option value="">-- Select a Rate List --</option>' : '<option value="">-- No Lists Available --</option>';
            lists.forEach(list => listSelect.innerHTML += `<option value="${list.id}">${list.name}</option>`);
            listSelect.disabled = lists.length === 0;
        } catch (e) {
            console.error("Failed to load package lists", e);
        }
    });

    // Rate List selection event
    listSelect.addEventListener('change', async () => {
        const listId = listSelect.value;
        packageData = [];
        populateDatalist();
        setItemSectionEnabled(false);

        if (!listId) return;

        try {
            const packageResponse = await fetch(`/api/packages-for-list?listId=${listId}`);
            packageData = await packageResponse.json();
            populateDatalist();
            setItemSectionEnabled(true);
        } catch (e) {
            console.error("Failed to load packages", e);
        }
    });
}

/**
 * Populates the <datalist> element with package options.
 */
function populateDatalist() {
    const datalist = document.getElementById('package-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    packageData.forEach(pkg => {
        const option = document.createElement('option');
        option.value = pkg.name;
        option.dataset.mrp = pkg.mrp;
        option.dataset.b2bPrice = pkg.b2b_price;
        datalist.appendChild(option);
    });
}

/**
 * Toggles the visibility of the B2B price column for CLIENT users.
 */
function handleB2BToggle() {
    const toggle = document.getElementById('b2b-visibility-toggle');
    const isVisible = toggle.checked;
    
    const itemHeader = document.querySelector('.item-header');
    const itemRows = document.querySelectorAll('.item-row');

    if (isVisible) {
        itemHeader?.classList.remove('b2b-hidden');
        itemRows.forEach(row => row.classList.remove('b2b-hidden'));
    } else {
        itemHeader?.classList.add('b2b-hidden');
        itemRows.forEach(row => row.classList.add('b2b-hidden'));
    }
}

/**
 * Sets up global event listeners for the form.
 */
function addGlobalEventListeners() {
    // Buttons and overall form inputs
    document.getElementById('add-item-btn').addEventListener('click', addItem);
    document.getElementById('discount_percentage').addEventListener('input', updateCalculations);
    document.getElementById('customer_toggle_btn').addEventListener('click', toggleCustomerMode);
    document.getElementById('clear_selection_btn').addEventListener('click', clearCustomerSelection);
    
    // Customer search input
    const searchInput = document.getElementById('customer_search');
    const suggestionsList = document.getElementById('customer_suggestions');
    searchInput.addEventListener('input', () => {
        clearTimeout(customerSearchTimeout);
        const query = searchInput.value;
        if (query.length < 1) {
            suggestionsList.innerHTML = '';
            suggestionsList.style.display = 'none';
            return;
        }
        customerSearchTimeout = setTimeout(() => fetchCustomerSuggestions(query), 300);
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        const searchContainer = document.getElementById('customer_search_container');
        if (searchContainer && !searchContainer.contains(e.target) && !document.getElementById('customer_toggle_btn').contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });

    // DOB/Age validation listeners
    document.getElementById('new_customer_dob').addEventListener('change', validateAgeDob);
    document.getElementById('new_customer_age').addEventListener('input', validateAgeDob);

    // Receipt-specific listeners
    if (currentFormType === 'receipt') {
        document.getElementById('amount_received').addEventListener('input', updateCalculations);
        document.getElementById('due_amount_manual').addEventListener('input', updateCalculations);
    }
}


// --- ITEM ROW MANAGEMENT ---

// --- DUPLICATE PACKAGE CHECK ---
/**
 * Checks if a given package name already exists in one of the item rows.
 * @param {string} packageName - The name of the package to check.
 * @param {HTMLElement} currentRow - The row being edited, to exclude it from the check.
 * @returns {boolean} - True if the package is a duplicate, false otherwise.
 */
function isDuplicatePackage(packageName, currentRow) {
    const allRows = document.querySelectorAll('.item-row');
    for (const row of allRows) {
        if (row === currentRow) continue; // Skip the row we're currently typing in
        
        const input = row.querySelector('.package-name-input');
        if (input && input.value.trim().toLowerCase() === packageName.trim().toLowerCase()) {
            return true;
        }
    }
    return false;
}


/**
 * Adds a new, empty item row to the form.
 */
function addItem() {
    const container = document.getElementById('items-container');
    const newItemRow = document.createElement('div');
    newItemRow.classList.add('item-row');
    const b2bInputHTML = currentUserRole === 'CLIENT'
        ? `<input type="number" name="b2b_prices[]" placeholder="B2B" step="0.01" min="0" readonly class="b2b-input b2b-col">`
        : '';

    newItemRow.innerHTML = `
        <input type="text" name="package_names[]" placeholder="Select or Type Package" list="package-list" required class="package-name-input item-calc-trigger">
        ${b2bInputHTML}
        <input type="number" name="mrps[]" placeholder="MRP" step="0.01" min="0" required class="mrp-input item-calc-trigger">
        <input type="number" name="item_discounts[]" placeholder="Disc %" step="0.1" min="0" max="100" value="0" class="discount-input item-calc-trigger">
        <span class="discount-amount-display">0.00</span>
        <button type="button" class="remove-item-btn" onclick="removeItem(this)">X</button>
    `;
    // Adjust grid for clients
    if (currentUserRole === 'CLIENT') {
        const itemHeader = document.querySelector('.item-header');
        itemHeader.classList.add('client-view');
        newItemRow.classList.add('client-view');
    }
    container.appendChild(newItemRow);
    addEventListenersToRow(newItemRow); // Add listeners to the new row
    updateCalculations();
}

/**
 * Removes an item row from the form.
 * @param {HTMLButtonElement} button - The remove button that was clicked.
 */
function removeItem(button) {
    const itemRow = button.closest('.item-row');
    if (document.querySelectorAll('.item-row').length > 1) {
        itemRow.remove();
        updateCalculations();
    } else {
        alert("At least one item is required.");
    }
}

/**
 * Adds event listeners to all inputs within a specific item row.
 * @param {HTMLElement} row - The item row element.
 */
function addEventListenersToRow(row) {
    const nameInput = row.querySelector('.package-name-input');
    const mrpInput = row.querySelector('.mrp-input');
    const discountInput = row.querySelector('.discount-input');

    // This listener handles AUTO-FILLING the price when a package is selected.
    nameInput.addEventListener('input', (e) => {
        const selectedName = e.target.value;
        const option = document.querySelector(`#package-list option[value="${selectedName}"]`);
        const b2bInput = row.querySelector('.b2b-input');
            
        if (option) {
            mrpInput.value = parseFloat(option.dataset.mrp || 0).toFixed(2);
            mrpInput.readOnly = true;
            if (currentUserRole === 'CLIENT' && b2bInput) {
                b2bInput.value = parseFloat(option.dataset.b2bPrice || 0).toFixed(2);
            }
        } else {
            // For custom items
            if (currentUserRole !== 'CLIENT') {
                mrpInput.readOnly = false; // Allow non-clients to enter custom items
                if (b2bInput) b2bInput.value = '';
            } else {
                // Prevent clients from entering custom items
                mrpInput.readOnly = true;
                mrpInput.value = '';
                if (b2bInput) b2bInput.value = '';
            }
        }
        updateCalculations();
    });

    // This listener handles DUPLICATE CHECKS when the user finishes entering a package name.
    nameInput.addEventListener('change', (e) => {
        const finalName = e.target.value.trim();
        const b2bInput = row.querySelector('.b2b-input');
        if (!finalName) return;

        if (isDuplicatePackage(finalName, row)) {
            alert(`'${finalName}' has already been added.`);
            e.target.value = '';
            mrpInput.value = '';
            if (b2bInput) b2bInput.value = '';
            mrpInput.readOnly = (currentUserRole === 'CLIENT');
            updateCalculations();
            return;
        }

        // Check for custom items for clients
        const option = document.querySelector(`#package-list option[value="${finalName}"]`);
        if (currentUserRole === 'CLIENT' && !option) {
            alert("Custom items cannot be added. Please select an existing test from the list.");
            e.target.value = '';
            mrpInput.value = '';
            if (b2bInput) b2bInput.value = '';
            updateCalculations();
        }
    });
    
    // Ensure MRP is editable if the user blurs from a custom package name
    nameInput.addEventListener('blur', () => {
        const currentName = nameInput.value;
        const option = document.querySelector(`#package-list option[value="${currentName}"]`);
        if (!option) {
            mrpInput.readOnly = false;
        }
    });

    mrpInput.addEventListener('input', updateCalculations);
    discountInput.addEventListener('input', updateCalculations);
}

/**
 * Helper function to iterate and add listeners to all existing rows on load.
 */
function addEventListenersToAllRows() {
    document.querySelectorAll('.item-row').forEach(addEventListenersToRow);
}


// --- CUSTOMER MANAGEMENT ---

/**
 * Toggles the UI between searching for an existing customer and entering a new one.
 */
function toggleCustomerMode() {
    const searchContainer = document.getElementById('customer_search_container');
    const isSearchVisible = searchContainer.style.display === 'block';
    setCustomerMode(isSearchVisible ? 'new' : 'search');
}

/**
 * Sets the customer section UI to a specific mode.
 * @param {'search' | 'new'} mode - The mode to switch to.
 */
function setCustomerMode(mode) {
    const searchContainer = document.getElementById('customer_search_container');
    const newFieldsContainer = document.getElementById('new_customer_fields');
    const displayContainer = document.getElementById('selected_customer_display');
    const toggleBtnIcon = document.getElementById('customer_toggle_btn').querySelector('i');
    const hiddenCustomerIdInput = document.getElementById('selected_customer_id');

    if (mode === 'search') {
        searchContainer.style.display = 'block';
        toggleBtnIcon.classList.remove('fa-magnifying-glass');
        toggleBtnIcon.classList.add('fa-user-plus');
        document.getElementById('customer_toggle_btn').title = "Enter New Customer";
        // <<< CHANGED: DO NOT HIDE THE EDITABLE FIELDS >>>
        // When in search mode, the editable fields should remain visible to allow for updates.
        newFieldsContainer.style.display = 'block'; 
    } else { // 'new' mode
        searchContainer.style.display = 'none';
        displayContainer.style.display = 'none'; // Hide selected customer info
        newFieldsContainer.style.display = 'block'; // Ensure editable fields are visible
        toggleBtnIcon.classList.remove('fa-user-plus');
        toggleBtnIcon.classList.add('fa-magnifying-glass');
        document.getElementById('customer_toggle_btn').title = "Search Existing Customer";
        hiddenCustomerIdInput.value = ''; // Clear selected ID
    }
}

/**
 * Clears the selected customer and switches back to "new customer" mode.
 */
function clearCustomerSelection() {
    // <<< CHANGED: This function is now much more thorough >>>
    // 1. Clear the hidden ID
    document.getElementById('selected_customer_id').value = '';
    
    // 2. Clear all the editable form fields
    document.getElementById('new_customer_name').value = '';
    document.getElementById('new_customer_mobile').value = '';
    document.getElementById('new_customer_dob').value = '';
    document.getElementById('new_customer_age').value = '';
    document.querySelector('input[name="new_customer_gender"][value="Male"]').checked = true;
    
    // 2.5. UNLOCK the fields to allow new entry
    document.getElementById('new_customer_name').readOnly = false;
    document.getElementById('new_customer_mobile').readOnly = false;
    document.getElementById('new_customer_dob').disabled = false;
    document.getElementById('new_customer_age').readOnly = false;
    document.querySelectorAll('input[name="new_customer_gender"]').forEach(radio => radio.disabled = false);

    // 3. Reset the UI to the "new" customer state
    setCustomerMode('new');

    // 4. Reset the header text in the fields section
    const header = document.querySelector('#new_customer_fields h4');
    if(header) header.textContent = 'Enter New Customer Details:';
}

/**

 * Fetches and displays customer suggestions based on the user's query.
 * @param {string} query - The search term.
 */
async function fetchCustomerSuggestions(query) {
    const suggestionsList = document.getElementById('customer_suggestions');
    try {
        const response = await fetch(`/api/customers/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Network error');
        const customers = await response.json();
        
        suggestionsList.innerHTML = '';
        if (customers.length > 0) {
            customers.forEach(cust => {
                const li = document.createElement('li');
                li.innerHTML = cust.display_text; // Use pre-formatted text from server
                // Store all customer data in dataset attributes for later use
                Object.keys(cust).forEach(key => {
                    li.dataset[key] = cust[key] || '';
                });
                li.addEventListener('click', () => selectCustomer(li.dataset));
                suggestionsList.appendChild(li);
            });
        } else {
            suggestionsList.innerHTML = '<li>No customers found</li>';
        }
        suggestionsList.style.display = 'block';
    } catch (error) {
        console.error('Error fetching customer suggestions:', error);
        suggestionsList.innerHTML = '<li>Error fetching data</li>';
        suggestionsList.style.display = 'block';
    }
}

/**
 * Populates the UI with the selected customer's data.
 * @param {DOMStringMap} customerData - The dataset from the selected suggestion item.
 */
function selectCustomer(customerData) {
    // 1. Populate the hidden ID field for the form submission
    document.getElementById('selected_customer_id').value = customerData.id;

    // 2. Populate the non-editable display area for user confirmation
    document.getElementById('display_customer_id').textContent = `CUST-${String(customerData.id).padStart(10, '0')}`;
    document.getElementById('display_customer_name').textContent = customerData.name;
    document.getElementById('display_customer_mobile').textContent = customerData.mobile || 'N/A';
    document.getElementById('display_customer_gender').textContent = customerData.gender || 'N/A';
    document.getElementById('display_customer_dob').textContent = customerData.dob_formatted || 'N/A';
    document.getElementById('display_customer_age').textContent = customerData.display_age || 'N/A';

    //3. Populate the *editable* form fields with the selected customer's data.
    document.getElementById('new_customer_name').value = customerData.name || '';
    document.getElementById('new_customer_mobile').value = customerData.mobile || '';
    document.getElementById('new_customer_dob').value = customerData.dob_formatted !== 'N/A' ? customerData.dob_formatted : '';
    document.getElementById('new_customer_age').value = customerData.age || '';
    if (customerData.gender) {
        const genderRadio = document.querySelector(`input[name="new_customer_gender"][value="${customerData.gender}"]`);
        if (genderRadio) genderRadio.checked = true;
    }
    // 3.5. Lock the fields to prevent editing
    document.getElementById('new_customer_name').readOnly = true;
    document.getElementById('new_customer_mobile').readOnly = true;
    document.getElementById('new_customer_dob').disabled = true; // For flatpickr, disabled is better
    document.getElementById('new_customer_age').readOnly = true;
    document.querySelectorAll('input[name="new_customer_gender"]').forEach(radio => radio.disabled = true);

    // 4. Update the UI to show the selection and hide the search suggestions
    document.getElementById('selected_customer_display').style.display = 'block';
    document.getElementById('customer_suggestions').style.display = 'none';
    document.getElementById('customer_search').value = '';
    
    // 5. <<< CHANGED: Update the header to guide the user >>>
    const header = document.querySelector('#new_customer_fields h4');
    if(header) header.textContent = 'Update Selected Customer Details:';
}

/**
 * Intercepts the receipt form submission to handle server responses via Fetch,
 * allowing for custom alerts on failure (e.g., insufficient balance).
 */
function initializeReceiptFormSubmitListener() {
    const form = document.getElementById('receipt-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        // Prevent the default browser form submission
        event.preventDefault();

        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        try {
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: form.method,
                body: new URLSearchParams(formData) // Standard form encoding
            });

            // If the server responds with a redirect (status 200-299), it was successful.
            if (response.ok) {
                // The server handled the redirect, so we follow it.
                window.location.href = response.url;
            } else {
                // If the server responds with an error (like 400 or 500)
                const errorMessage = await response.text();
                
                // Show the specific error from the server in a pop-up
                alert(`Error: ${errorMessage}\n\nPlease check the details and contact an administrator if the issue persists.`);
                
                submitButton.disabled = false;
                submitButton.textContent = 'Generate & Save Receipt';
            }
        } catch (error) {
            // Handle network errors
            console.error('Network or submission error:', error);
            alert('A network error occurred. Please check your connection and try again.');
            submitButton.disabled = false;
            submitButton.textContent = 'Generate & Save Receipt';
        }
    });
}

/**
 * Basic validation logic for DOB/Age fields.
 */
function validateAgeDob() {
    // This can be expanded with more complex UI feedback if needed
}


// --- LIVE CALCULATIONS ---

/**
 * The main calculation engine. Recalculates all totals based on the current form type.
 */
function updateCalculations() {
    let totalMrp = 0;
    let subtotalAfterItemDiscounts = 0;
    let totalB2B = 0;

    // 1. Loop through each item row and calculate subtotals
    document.querySelectorAll('.item-row').forEach(row => {
        const mrp = parseFloat(row.querySelector('.mrp-input').value) || 0;
        const itemDiscPercInput = row.querySelector('.discount-input');
        let itemDiscPerc = parseFloat(itemDiscPercInput.value) || 0;

        // Clamp item discount between 0 and 100
        if (itemDiscPerc < 0) itemDiscPerc = 0;
        if (itemDiscPerc > 100) itemDiscPerc = 100;
        itemDiscPercInput.value = itemDiscPerc;

        const itemPriceAfterDiscount = mrp * (1 - (itemDiscPerc / 100));
        totalMrp += mrp;
        subtotalAfterItemDiscounts += itemPriceAfterDiscount;
        if (currentUserRole === 'CLIENT') {
            const b2b = parseFloat(row.querySelector('.b2b-input').value) || 0;
            totalB2B += b2b;
        }

        const itemDiscAmount = mrp * (itemDiscPerc / 100);
        row.querySelector('.discount-amount-display').textContent = itemDiscAmount.toFixed(2);
    });

    // 2. Final total is calculated without overall discount
    const overallDiscountAmount = 0;
    const finalTotal = subtotalAfterItemDiscounts;

    // 3. Update the shared UI elements
    document.getElementById('calculated-mrp').textContent = totalMrp.toFixed(2);
    document.getElementById('calculated-subtotal').textContent = subtotalAfterItemDiscounts.toFixed(2);
    document.getElementById('calculated-overall-discount-amount').textContent = overallDiscountAmount.toFixed(2);

    // 4. Update the form-specific UI elements
    if (currentFormType === 'receipt') {
        const receivedAmountInput = document.getElementById('amount_received');
        let receivedAmount = parseFloat(receivedAmountInput.value) || 0;
        if (receivedAmount < 0) {
            receivedAmount = 0;
            receivedAmountInput.value = 0;
        }

        const dueAmountManualInput = document.getElementById('due_amount_manual');
        const dueAmountManualValue = dueAmountManualInput.value.trim();
        let dueAmount = 0;

        if (dueAmountManualValue !== "" && !isNaN(parseFloat(dueAmountManualValue)) && parseFloat(dueAmountManualValue) >= 0) {
            dueAmount = parseFloat(dueAmountManualValue);
        } else {
            dueAmount = Math.max(0, finalTotal - receivedAmount);
        }

        document.getElementById('calculated-total-receipt').textContent = finalTotal.toFixed(2);
        document.getElementById('calculated-due').textContent = dueAmount.toFixed(2);

    } else { // 'estimate' form
        document.getElementById('calculated-total').textContent = finalTotal.toFixed(2);
    }
    // Update B2B and Profit fields if they exist (for CLIENT role)
    if (currentUserRole === 'CLIENT') {
        const totalB2BEl = document.getElementById('calculated-total-b2b');
        const profitEl = document.getElementById('calculated-profit');
        if (totalB2BEl && profitEl) {
            const profit = finalTotal - totalB2B;
            totalB2BEl.textContent = totalB2B.toFixed(2);
            profitEl.textContent = profit.toFixed(2);
        }
    }
}