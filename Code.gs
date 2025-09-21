// === CONFIGURATION ===
const SHEET_NAME = "WAFA Bookings";
const CALENDAR_ID = "wafadentalclinics@gmail.com";
const TIMEZONE = "Asia/Karachi";

// === MAIN FUNCTION: HANDLE FORM SUBMISSION ===
function doPost(e) {
  try {
    const data = e.parameter;
    Logger.log("Received data: " + JSON.stringify(data));

    // --- Step 1: Validate required fields ---
    const requiredFields = ['FirstName', 'LastName', 'Email', 'Phone', 'Service', 'Date', 'Time'];
    for (const field of requiredFields) {
      if (!data[field] || String(data[field]).trim() === '') {
        throw new Error(`${field} is required.`);
      }
    }

    const spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet named "${SHEET_NAME}" not found.`);
    }

    // --- Step 2: Generate Deterministic Client ID & Check for Existing Client ---
    const clientId = generateDeterministicClientId(data);
    const clientRow = findClientRowByClientId(sheet, clientId);
    
    if (clientRow) {
      Logger.log(`Returning client found. Client ID: ${clientId}`);
    } else {
      Logger.log(`New client detected. Generating new Client ID: ${clientId}`);
    }

    // --- Step 3: Check Slot Availability ---
    const requestedSlotKey = `${data.Date} ${data.Time}`;
    const bookedCounts = getBookedSlotsCount(sheet);
    const currentBookings = bookedCounts[requestedSlotKey] || 0;
    const MAX_BOOKINGS_PER_SLOT = 2;

    if (currentBookings >= MAX_BOOKINGS_PER_SLOT) {
      throw new Error("Time slot not available. Please choose a different time.");
    }

    // --- Step 4: Generate Unique Booking ID ---
    const bookingID = generateBookingID(sheet);
    const fullName = `${data.FirstName} ${data.LastName}`;

    // --- Step 5: Create Calendar Event ---
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const startTime = new Date(`${data.Date} ${data.Time}`);
    const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 min appointment
    const calendarEvent = calendar.createEvent(
      `${bookingID} - ${fullName} - ${data.Service}`,
      startTime,
      endTime,
      { description: data.Notes || '' }
    );
    const calendarEventId = calendarEvent.getId();

    // --- Step 6: Generate PDF, save to Drive, and get Base64 content ---
    const pdfResult = generatePDF(bookingID, clientId, data);

    // --- Step 7: Append booking to Sheet ---
    sheet.appendRow([
      clientId,
      bookingID,
      fullName,
      data.Email,
      `'${data.Phone}`,
      data.Service,
      data.Date,
      data.Time,
      calendarEventId,
      `https://drive.google.com/uc?export=download&id=${pdfResult.fileId}`, // Doc URL
      new Date()
    ]);

    // --- Step 8: Return Success Response with PDF ---
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      bookingID: bookingID,
      clientID: clientId,
      pdfBase64: pdfResult.base64
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error in doPost: " + err.message + " Stack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * A test function to force the DriveApp authorization prompt.
 * Run this function manually from the Apps Script editor to grant permissions.
 */
function testCreateFile() {
  try {
    // This line requires Google Drive permissions. Running it will trigger the auth flow.
    DriveApp.getRootFolder();
    Logger.log("Permissions for DriveApp appear to be granted.");
    // You can show an alert to the user in the editor.
    SpreadsheetApp.getUi().alert("Success! Permissions for Google Drive have been granted.");
  } catch (e) {
    Logger.log("Error while testing DriveApp permissions: " + e.message);
    SpreadsheetApp.getUi().alert("An error occurred. Please ensure you have completed the authorization steps. Error: " + e.message);
  }
}

// === CLIENT ID UTILITY: Generate a consistent ID based on user info ===
function generateDeterministicClientId(data) {
  const identifierString = `${data.FirstName.trim()}${data.LastName.trim()}${data.Email.trim()}${data.Phone.trim()}`.toLowerCase();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identifierString);
  let hexString = '';
  for (let i = 0; i < hash.length; i++) {
    let byte = hash[i];
    if (byte < 0) {
      byte += 256;
    }
    const hex = byte.toString(16);
    if (hex.length === 1) {
      hexString += '0';
    }
    hexString += hex;
  }
  // Use the first 10 characters of the hash for the ID
  return `WDC-${hexString.substring(0, 10).toUpperCase()}`;
}

// === CLIENT ID UTILITY: Find a client's first row by their ID ===
function findClientRowByClientId(sheet, clientId) {
  const data = sheet.getRange("A:A").getValues(); // Search only in the Client ID column
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === clientId) {
      return i + 1; // Return the 1-based row number
    }
  }
  return null; // Client not found
}


// === UTILITY: Generate Sequential Booking ID ===
function generateBookingID(sheet) {
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  const lastRow = sheet.getLastRow();
  let lastNum = 0;
  if (lastRow > 1) {
    const lastBookingID = sheet.getRange(lastRow, 2).getValue(); // Booking ID is in column 2
    const parts = String(lastBookingID).split('-');
    if (parts.length > 2) {
      lastNum = parseInt(parts[2], 10);
    }
  }
  const nextNum = (lastNum + 1).toString().padStart(4, '0');
  return `WAFA-${dateStr}-${nextNum}`;
}

// === UTILITY: Generate PDF Confirmation ===
function generatePDF(bookingID, clientID, data) {
  const fullName = `${data.FirstName} ${data.LastName}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WAFA Dental Clinic - Booking Confirmation</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; color: #343a40; }
        .receipt-container { max-width: 700px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); overflow: hidden; }
        .header { background-color: #010245; color: #ffffff; padding: 25px 30px; text-align: center; }
        .header h1 { font-family: 'DM Serif Display', serif; font-size: 32px; margin: 0; }
        .header p { font-size: 15px; margin: 5px 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .section-title { font-family: 'DM Serif Display', serif; font-size: 24px; color: #010245; margin-top: 35px; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 2px solid #e9ecef; }
        .section-title:first-of-type { margin-top: 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px 25px; margin-bottom: 25px; }
        .info-item strong { display: block; font-size: 13px; color: #6c757d; margin-bottom: 3px; }
        .info-item span { font-size: 16px; color: #343a40; font-weight: 500; }
        .notes { background-color: #f0f8ff; border-left: 4px solid #007bff; padding: 15px; margin-top: 25px; border-radius: 8px; font-size: 14px; color: #004085; }
        .footer { background-color: #f1f3f5; padding: 20px 30px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef; margin-top: 40px; }
        .footer a { color: #010245; text-decoration: none; }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="receipt-container">
        <div class="header"><h1>Your Booking is Confirmed!</h1><p>Thank you for choosing WAFA Dental Clinic.</p></div>
        <div class="content">
          <h2 class="section-title">Patient Details</h2>
          <div class="info-grid">
            <div class="info-item"><strong>Client ID:</strong><span>${clientID}</span></div>
            <div class="info-item"><strong>Patient Name:</strong><span>${fullName}</span></div>
            <div class="info-item"><strong>Email:</strong><span>${data.Email}</span></div>
            <div class="info-item"><strong>Phone:</strong><span>${data.Phone}</span></div>
          </div>
          <h2 class="section-title">Appointment Information</h2>
          <div class="info-grid">
            <div class="info-item"><strong>Booking ID:</strong><span>${bookingID}</span></div>
            <div class="info-item"><strong>Service:</strong><span>${data.Service}</span></div>
            <div class="info-item"><strong>Date:</strong><span>${data.Date}</span></div>
            <div class="info-item"><strong>Time:</strong><span>${data.Time}</span></div>
          </div>
          ${data.Notes ? `<div class="notes"><strong>Notes:</strong> ${data.Notes}</div>` : ''}
          <div class="notes" style="background-color: #d4edda; border-left-color: #28a745; color: #155724; margin-top: 30px;"><strong>Cancellation Policy:</strong> Please contact us at least 24 hours in advance for any changes.</div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} WAFA Dental Clinic. All rights reserved.<br>
          Office #7, 3rd Floor, The Ark Building, I-8 Markaz, Islamabad, Pakistan<br>
          <a href="https://www.wafadentalclinic.com" target="_blank">www.wafadentalclinic.com</a> | <a href="https://www.google.com/maps/place/WAFA+Dental+Clinic/@33.6673337,73.0747596,17z/data=!3m1!4b1!4m6!3m5!1s0x38df957cc7644563:0x27a7ae2e6cda42ef!8m2!3d33.6673337!4d73.0747596!16s%2Fg%2F11xd1rytr0">View on Google Maps</a>
        </div>
      </div>
    </body>
    </html>`;
  
  const blob = Utilities.newBlob(htmlContent, 'text/html', `${bookingID}.html`);
  const pdf = blob.getAs('application/pdf').setName(`${bookingID}.pdf`);
  
  // Save a copy to Google Drive
  const file = DriveApp.createFile(pdf);
  const fileId = file.getId();

  // Return both the file ID and the base64 content
  return {
    fileId: fileId,
    base64: Utilities.base64Encode(pdf.getBytes())
  };
}

// === UTILITY: Get Booked Slots Count ===
function getBookedSlotsCount(sheet) {
  const allData = sheet.getDataRange().getValues();
  const bookedSlotsCount = {};
  // Start from 1 to skip header row
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const date = row[6]; // Date is in column 7
    const time = row[7]; // Time is in column 8
    if (date && time) {
      const slotKey = `${date} ${time}`;
      bookedSlotsCount[slotKey] = (bookedSlotsCount[slotKey] || 0) + 1;
    }
  }
  return bookedSlotsCount;
}

// === UTILITY: Fetch booked slots for real-time availability check on frontend ===
function doGet(e) {
  try {
    if (e.parameter.action === 'getBookedSlots') {
      const spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
      const sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) {
        throw new Error(`Sheet named "${SHEET_NAME}" not found.`);
      }
      const bookedSlots = getBookedSlotsCount(sheet);
      return ContentService.createTextOutput(JSON.stringify(bookedSlots))
                           .setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Invalid GET request action.");
    }
  } catch (err) {
    Logger.log("Error in doGet: " + err.message);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
