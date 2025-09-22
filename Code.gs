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
      Logger.log(`Slot unavailable. Requested: ${requestedSlotKey}, Found: ${currentBookings}`);
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
    const pdfResult = generatePremiumPDF(bookingID, clientId, data);

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
function testAndAuthorize() {
  try {
    Logger.log("Starting permission test...");
    const folder = DriveApp.getRootFolder();
    Logger.log("Successfully accessed root folder: " + folder.getName());
    SpreadsheetApp.getUi().alert("Success! Permissions for Google Drive have been granted. You can now try submitting a booking on the website.");
    Logger.log("Permission test successful.");
  } catch (e) {
    Logger.log("Error while testing DriveApp permissions: " + e.message);
    SpreadsheetApp.getUi().alert("An error occurred. Please carefully follow the authorization steps in the pop-up window. If it continues to fail, check the logs. Error: " + e.message);
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
  return `WDC-${hexString.substring(0, 10).toUpperCase()}`;
}

// === CLIENT ID UTILITY: Find a client's first row by their ID ===
function findClientRowByClientId(sheet, clientId) {
  const data = sheet.getRange("A:A").getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === clientId) {
      return i + 1;
    }
  }
  return null;
}

// === UTILITY: Generate Sequential Booking ID ===
function generateBookingID(sheet) {
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  const lastRow = sheet.getLastRow();
  let lastNum = 0;
  if (lastRow > 1) {
    const lastBookingID = sheet.getRange(lastRow, 2).getValue();
    const parts = String(lastBookingID).split('-');
    if (parts.length > 2) {
      lastNum = parseInt(parts[2], 10);
    }
  }
  const nextNum = (lastNum + 1).toString().padStart(4, '0');
  return `WAFA-${dateStr}-${nextNum}`;
}

// === UTILITY: Fetch Logo and Encode as Base64 ===
function getLogoBase64() {
  const logoUrl = "https://raw.githubusercontent.com/wafadentalclinics/wafa-dental-clinic/main/images/logo.png";
  try {
    const imageBlob = UrlFetchApp.fetch(logoUrl).getBlob();
    return `data:image/png;base64,${Utilities.base64Encode(imageBlob.getBytes())}`;
  } catch (e) {
    Logger.log("Could not fetch logo image: " + e.message);
    return ""; // Return empty string if logo fails to load
  }
}

// === UTILITY: Generate PREMIUM PDF Confirmation ===
function generatePremiumPDF(bookingID, clientID, data) {
  const fullName = `${data.FirstName} ${data.LastName}`;
  const logoBase64 = getLogoBase64();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WAFA Dental Clinic - Booking Confirmation</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', sans-serif; color: #333; -webkit-print-color-adjust: exact; }
        .page { width: 210mm; height: 297mm; margin: 0 auto; background: #fff; padding: 25mm; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #010245; padding-bottom: 20px; }
        .header .logo { width: 80px; height: auto; }
        .header .clinic-info { text-align: right; }
        .header .clinic-info h1 { font-family: 'DM Serif Display', serif; font-size: 36pt; color: #010245; margin: 0; }
        .header .clinic-info p { margin: 2px 0 0; font-size: 10pt; color: #555; }
        .title { font-family: 'DM Serif Display', serif; font-size: 28pt; color: #010245; text-align: center; margin: 30px 0; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; margin-top: 25px; }
        .detail-item { background-color: #f8f9fa; border-radius: 8px; padding: 15px; }
        .detail-item strong { display: block; font-size: 10pt; color: #6c757d; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
        .detail-item span { font-size: 14pt; color: #010245; font-weight: 500; }
        .section-heading { font-family: 'DM Serif Display', serif; font-size: 18pt; color: #010245; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px; }
        .footer { position: absolute; bottom: 25mm; left: 25mm; right: 25mm; text-align: center; font-size: 9pt; color: #888; border-top: 1px solid #eee; padding-top: 15px; }
        .footer a { color: #010245; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <img src="${logoBase64}" alt="Logo" class="logo"/>
          <div class="clinic-info">
            <h1>WAFA Dental Clinic</h1>
            <p>Your Smile, Our Priority</p>
          </div>
        </div>
        <h2 class="title">Your Booking is Confirmed!</h2>
        <p style="text-align: center; font-size: 12pt; color: #555; margin-top: -20px;">
          Dear ${fullName}, thank you for choosing us. We look forward to seeing you at your appointment.
        </p>
        <h3 class="section-heading">Appointment Details</h3>
        <div class="details-grid">
          <div class="detail-item"><strong>Service</strong><span>${data.Service}</span></div>
          <div class="detail-item"><strong>Booking ID</strong><span>${bookingID}</span></div>
          <div class="detail-item"><strong>Date</strong><span>${data.Date}</span></div>
          <div class="detail-item"><strong>Time</strong><span>${data.Time}</span></div>
        </div>
        <h3 class="section-heading">Patient Information</h3>
        <div class="details-grid">
          <div class="detail-item"><strong>Client ID</strong><span>${clientID}</span></div>
          <div class="detail-item"><strong>Phone</strong><span>${data.Phone}</span></div>
        </div>
        <div class="footer">
          Office #7, 3rd Floor, The Ark Building, I-8 Markaz, Islamabad, Pakistan<br/>
          <a href="https://www.wafadentalclinic.com">www.wafadentalclinic.com</a> | For inquiries, please call +92 51 8448877
        </div>
      </div>
    </body>
    </html>`;
  
  const blob = Utilities.newBlob(htmlContent, 'text/html', `${bookingID}.html`);
  const pdf = blob.getAs('application/pdf').setName(`${bookingID}.pdf`);
  
  const file = DriveApp.createFile(pdf);
  const fileId = file.getId();

  return {
    fileId: fileId,
    base64: Utilities.base64Encode(pdf.getBytes())
  };
}

// === UTILITY: Get Booked Slots Count (FIXED) ===
function getBookedSlotsCount(sheet) {
  const allData = sheet.getDataRange().getValues();
  const bookedSlotsCount = {};
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const dateValue = row[6];
    const time = row[7];
    if (dateValue instanceof Date && time) {
      const formattedDate = Utilities.formatDate(dateValue, TIMEZONE, "MM/dd/yyyy");
      const slotKey = `${formattedDate} ${time}`;
      bookedSlotsCount[slotKey] = (bookedSlotsCount[slotKey] || 0) + 1;
    }
  }
  Logger.log("Counted Slots: " + JSON.stringify(bookedSlotsCount));
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
