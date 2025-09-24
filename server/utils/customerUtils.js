// medical_receipt_system/server/utils/customerUtils.js
const db = require("../db");
const { formatDateForDatabase } = require("./dateUtils");

function findOrCreateCustomer(customerData, createdByUserId = null) {
  const { id, name, mobile, dob, age, gender } = customerData;
  const nowISO = new Date().toISOString();

  // --- Validation ---
  if (!id && (!name || name.trim() === "")) {
    // Name required only for NEW customers
    throw new Error("Customer name is required for new customer.");
  }
  const nameTrimmed = name ? name.trim() : null;
  const mobileTrimmed = mobile ? String(mobile).trim() : null;
  const dobFormatted = formatDateForDatabase(dob); // YYYY-MM-DD or null
  const ageInt =
    age && String(age).trim() !== "" && !isNaN(parseInt(age, 10))
      ? parseInt(age, 10)
      : null;

  if (ageInt !== null && (ageInt < 0 || ageInt > 130)) {
    throw new Error("Invalid Age provided (must be 0-130).");
  }

  // --- Update existing customer (if ID provided) ---
  if (id) {
    const existingCustomerById = db
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(id);
    if (!existingCustomerById) {
      console.error(
        `Error: Customer ID ${id} was provided for update but not found.`
      );
      throw new Error(
        `Selected customer (ID: ${id}) not found. Please clear selection and try again.`
      );
    }

    // Determine final values for update, preferring newly provided valid data
    const updateName = nameTrimmed || existingCustomerById.name;
    const updateMobile =
      mobileTrimmed !== null ? mobileTrimmed : existingCustomerById.mobile;
    const updateDob = dobFormatted || existingCustomerById.dob;
    const updateAge = dobFormatted
      ? null
      : ageInt !== null
      ? ageInt
      : existingCustomerById.age;
    const updateGender = gender || existingCustomerById.gender;

    // Check if anything actually changed
    const detailsChanged =
      updateName !== existingCustomerById.name ||
      updateMobile !== existingCustomerById.mobile ||
      updateDob !== existingCustomerById.dob ||
      updateAge !== existingCustomerById.age ||
      updateGender !== existingCustomerById.gender;

    if (detailsChanged) {
      console.log(`Updating details for customer ID ${id}...`);
      try {
        db.prepare(
          `UPDATE customers 
           SET name = ?, mobile = ?, dob = ?, age = ?, gender = ?, updated_at = ? 
           WHERE id = ?`
        ).run(
          updateName,
          updateMobile,
          updateDob,
          updateAge,
          updateGender,
          nowISO,
          id
        );
        console.log(`Customer ID ${id} updated.`);
      } catch (updateErr) {
        if (updateErr.code === "SQLITE_CONSTRAINT_UNIQUE") {
          throw new Error(
            `Mobile number ${updateMobile} is already registered.`
          );
        } else {
          throw updateErr;
        }
      }
    } else {
      console.log(`No changes detected for customer ID ${id}.`);
    }
    return id; // Return existing ID
  }

  // --- Find by Mobile or Create New (if no ID provided) ---
  if (mobileTrimmed) {
    const existingCustomerByMobile = db
      .prepare("SELECT id FROM customers WHERE mobile = ?")
      .get(mobileTrimmed);
    if (existingCustomerByMobile) {
      console.log(
        `Found existing customer by mobile ${mobileTrimmed}: ID ${existingCustomerByMobile.id}`
      );
      throw new Error(
        `Mobile number ${mobileTrimmed} is already registered to another customer (ID: ${existingCustomerByMobile.id}). Please search for the existing customer or use a different mobile number.`
      );
    }
  }

  // --- Create new customer record ---
  if (!nameTrimmed) {
    throw new Error(
      "Customer name is required to create a new customer record."
    );
  }
  const finalAgeValue = dobFormatted ? null : ageInt;

  console.log(
    `Creating new customer: Name=${nameTrimmed}, Mobile=${mobileTrimmed}, DOB=${dobFormatted}, Age=${finalAgeValue}`
  );

  const insertStmt = db.prepare(
    `INSERT INTO customers (name, mobile, dob, age, gender, created_at, updated_at, created_by_user_id) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    const info = insertStmt.run(
      nameTrimmed,
      mobileTrimmed,
      dobFormatted,
      finalAgeValue,
      gender,
      nowISO,
      nowISO,
      createdByUserId
    );
    const customerId = info.lastInsertRowid;
    console.log(`Created new customer: ID ${customerId}`);
    return customerId;
  } catch (insertErr) {
    if (insertErr.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Mobile number ${mobileTrimmed} is already registered.`);
    } else {
      throw insertErr;
    }
  }
}

module.exports = { findOrCreateCustomer };
