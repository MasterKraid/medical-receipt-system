// medical_receipt_system/server/utils/dateUtils.js
/**
 * Parses a date string (potentially DD/MM/YYYY or YYYY-MM-DD) or Date object
 * and returns it in YYYY-MM-DD format suitable for database storage.
 * Returns null if the input is invalid or cannot be parsed.
 *
 * @param {string|Date|null|undefined} dateInput - The date input from the form or other source.
 * @returns {string|null} - Date in YYYY-MM-DD format or null.
 */
function formatDateForDatabase(dateInput) {
    if (!dateInput) return null;

    try {
        let year, month, day;

        if (typeof dateInput === 'string') {
            dateInput = dateInput.split('T')[0]; // Remove time part if present

            // Check for DD/MM/YYYY format
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateInput)) {
                const parts = dateInput.split('/');
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10); // Month is 1-based
                year = parseInt(parts[2], 10);

                if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
                   console.warn(`Invalid DD/MM/YYYY date parts: ${dateInput}`);
                   return null;
                }
                 // Basic validation for day based on month (doesn't handle leap years perfectly but good enough)
                 const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                 if (day > daysInMonth[month - 1]) {
                     console.warn(`Invalid day ${day} for month ${month} in date: ${dateInput}`);
                     return null;
                 }

            }
            // Check for YYYY-MM-DD format
            else if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                const parts = dateInput.split('-');
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10); // Month is 1-based
                day = parseInt(parts[2], 10);

                 if (isNaN(day) || isNaN(month) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31) {
                    console.warn(`Invalid YYYY-MM-DD date parts: ${dateInput}`);
                    return null;
                 }
                  // Basic validation
                  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
                  if (day > daysInMonth[month - 1]) {
                      console.warn(`Invalid day ${day} for month ${month} in date: ${dateInput}`);
                      return null;
                  }
            }
            // Try parsing with Date object as a fallback (less reliable for specific formats)
            else {
                const d = new Date(dateInput);
                 if (isNaN(d.getTime())) {
                     console.warn(`Could not parse date string reliably: ${dateInput}`);
                     return null;
                 }
                 // Use UTC methods to avoid timezone issues when extracting parts
                 year = d.getUTCFullYear();
                 month = d.getUTCMonth() + 1; // Month is 0-based from getUTCMonth
                 day = d.getUTCDate();
            }

        } else if (dateInput instanceof Date) {
            // If it's already a Date object
            if (isNaN(dateInput.getTime())) {
                console.warn(`Received invalid Date object.`);
                return null;
            }
            // Use UTC methods to avoid timezone issues
            year = dateInput.getUTCFullYear();
            month = dateInput.getUTCMonth() + 1; // Month is 0-based from getUTCMonth
            day = dateInput.getUTCDate();
        } else {
             console.warn(`Unsupported date input type: ${typeof dateInput}`);
             return null; // Invalid type
        }

        // Format to YYYY-MM-DD
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;

    } catch (e) {
        console.error("Error in formatDateForDatabase:", e, "Input:", dateInput);
        return null;
    }
}


/**
 * Formats a date string (expected YYYY-MM-DD) or Date object to DD/MM/YYYY for display.
 * Returns 'N/A' if the input is invalid or null.
 *
 * @param {string|Date|null|undefined} dateString - The date string (YYYY-MM-DD) or Date object from DB/source.
 * @returns {string} - Date in DD/MM/YYYY format or 'N/A'.
 */
function formatDateForDisplay(dateString) {
    if (!dateString || dateString === 'N/A') return "N/A";

    try {
        let dateObj;
        // Primarily expect 'YYYY-MM-DD' from the database
        if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const parts = dateString.split('-');
            // Constructing with UTC avoids timezone shifts converting string->object->string
            dateObj = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
            if (isNaN(dateObj.getTime())) {
                console.warn(`Invalid date string for display (YYYY-MM-DD expected): ${dateString}`);
                return "N/A";
            }
            const day = String(dateObj.getUTCDate()).padStart(2, '0');
            const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const year = dateObj.getUTCFullYear();
            return `${day}/${month}/${year}`;
        } else {
            // Fallback for Date objects or other string formats (less common from DB)
            dateObj = new Date(dateString);
            if (isNaN(dateObj.getTime())) {
                console.warn(`Invalid date object or non-YYYY-MM-DD string for display: ${dateString}`);
                return "N/A";
            }
            // Use non-UTC methods here if the object might have local time info intended
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {
        console.error("Error in formatDateForDisplay:", e, "Input:", dateString);
        return "N/A";
    }
}


/**
 * Formats a timestamp string or Date object into 'DD/MM/YYYY hh:mm AM/PM' (IST/GMT+5:30).
 * Uses Intl.DateTimeFormat for robust timezone and locale formatting.
 * Returns the original timestamp or 'N/A' on failure.
 *
 * @param {string|Date|null|undefined} timestamp - The timestamp string or object.
 * @returns {string} - Formatted timestamp or 'N/A' or original on error.
 */
function formatTimestampForDisplayIST(timestamp) {
    if (!timestamp) return "N/A";

    try {
        const dateObj = new Date(timestamp);
        if (isNaN(dateObj.getTime())) {
            console.warn(`Invalid timestamp for IST formatting: ${timestamp}`);
            return String(timestamp); // Return original if invalid
        }

        // Use Intl.DateTimeFormat for robust timezone and formatting control
        const formatter = new Intl.DateTimeFormat("en-IN", { // Indian English locale
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true, // Use 12-hour clock with AM/PM
            timeZone: "Asia/Kolkata", // Explicitly set IST
        });

        // Format and remove potential comma between date and time
        return formatter.format(dateObj).replace(",", "");

    } catch (e) {
        console.error("Error formatting timestamp for display (IST):", e, "Input:", timestamp);
        // Fallback or return original on error
        return String(timestamp); // Return original string representation if Intl fails
    }
}

module.exports = {
    formatDateForDatabase,
    formatDateForDisplay,
    formatTimestampForDisplayIST,
};