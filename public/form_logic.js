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
    initializeLabAndPackageLogic();

    // Add all necessary event listeners
    addGlobalEventListeners();
    addEventListenersToAllRows();
    updateCalculations(); // Initial calculation on page load

    // Set the initial customer mode to 'new'
    setCustomerMode('new');
}

// --- NEW LAB + PACKAGE FETCHING LOGIC ---
async function initializeLabAndPackageLogic() {
    const labSelect = document.getElementById('lab_selection');
    if (!labSelect) {
        console.error("Lab selection dropdown not found!");
        return;
    }

    try {
        // 1. Fetch the labs this user has access to
        const response = await fetch('/api/user-labs');
        if (!response.ok) throw new Error('Failed to fetch user labs');
        const labs = await response.json();

        // 2. Populate the lab dropdown
        if (labs.length === 0) {
            labSelect.innerHTML = '<option value="">No labs assigned to you</option>';
            labSelect.disabled = true;
            return;
        }

        labSelect.innerHTML = '<option value="">-- Select a Lab --</option>';
        labs.forEach(lab => {
            const option = document.createElement('option');
            option.value = lab.id;
            option.textContent = lab.name;
            labSelect.appendChild(option);
        });

        // 3. Fetch packages when lab changes
        labSelect.addEventListener('change', async () => {
            const selectedLabId = labSelect.value;
            const itemsContainer = document.getElementById('items-container');
            const addItemBtn = document.getElementById('add-item-btn');

            if (!selectedLabId) {
                packageData = [];
                populateDatalist();
                itemsContainer.style.opacity = '0.5';
                itemsContainer.style.pointerEvents = 'none';
                addItemBtn.disabled = true;
            } else {
                await fetchPackagesForLab(selectedLabId);
                itemsContainer.style.opacity = '1';
                itemsContainer.style.pointerEvents = 'auto';
                addItemBtn.disabled = false;
            }
        });

        // 4. Initially disable the items section
        document.getElementById('items-container').style.opacity = '0.5';
        document.getElementById('items-container').style.pointerEvents = 'none';
        document.getElementById('add-item-btn').disabled = true;

    } catch (error) {
        console.error("Error during lab initialization:", error);
        alert("Could not load lab data. Please refresh the page.");
    }
}

async function fetchPackagesForLab(labId) {
    try {
        console.log(`Fetching packages for lab ID: ${labId}`);
        const response = await fetch(`/api/packages?labId=${labId}`);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        packageData = await response.json();
        populateDatalist();
        console.log(`Loaded ${packageData.length} packages.`);
    } catch (error) {
        console.error("Failed to fetch packages:", error);
        alert("Could not load package data for the selected lab.");
    }
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
    newItemRow.innerHTML = `
        <input type="text" name="package_names[]" placeholder="Select or Type Package" list="package-list" required class="package-name-input item-calc-trigger">
        <input type="number" name="mrps[]" placeholder="MRP" step="0.01" min="0" required class="mrp-input item-calc-trigger">
        <input type="number" name="item_discounts[]" placeholder="Disc %" step="0.1" min="0" max="100" value="0" class="discount-input item-calc-trigger">
        <span class="discount-amount-display">0.00</span>
        <button type="button" class="remove-item-btn" onclick="removeItem(this)">X</button>
    `;
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

        if (option) {
            // DECIDE WHICH PRICE TO USE BASED ON USER ROLE
            const priceToUse = currentUserRole === 'CLIENT' ? option.dataset.b2bPrice : option.dataset.mrp;
            mrpInput.value = parseFloat(priceToUse || 0).toFixed(2);
            mrpInput.readOnly = true; // Lock price for predefined packages
        } else {
            mrpInput.readOnly = false; // Unlock for custom entries
        }
        updateCalculations();
    });

    // This listener handles DUPLICATE CHECKS when the user finishes entering a package name.
    nameInput.addEventListener('change', (e) => {
        const finalName = e.target.value.trim();
        if (!finalName) return; // Ignore if empty

        if (isDuplicatePackage(finalName, row)) {
            alert(`'${finalName}' has already been added. Please choose a different test or remove the other entry.`);
            e.target.value = ''; // Clear the invalid input
            mrpInput.value = ''; // Clear the associated price
            mrpInput.readOnly = false;
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

        const itemDiscAmount = mrp * (itemDiscPerc / 100);
        row.querySelector('.discount-amount-display').textContent = itemDiscAmount.toFixed(2);
    });

    // 2. Calculate overall discount
    const overallDiscountInput = document.getElementById('discount_percentage');
    let overallDiscountPercent = parseFloat(overallDiscountInput.value) || 0;

    // Clamp overall discount between 0 and 100
    if (overallDiscountPercent < 0) overallDiscountPercent = 0;
    if (overallDiscountPercent > 100) overallDiscountPercent = 100;
    overallDiscountInput.value = overallDiscountPercent;
    
    const overallDiscountAmount = subtotalAfterItemDiscounts * (overallDiscountPercent / 100);
    const finalTotal = subtotalAfterItemDiscounts - overallDiscountAmount;

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
}