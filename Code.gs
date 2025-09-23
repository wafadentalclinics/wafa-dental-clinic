// === CONFIGURATION ===
const RESEND_API_KEY = "re_BtcZWuVZ_NJhAQBudfFufERALf1aXQQAk";
const SHEET_NAME = "WAFA Bookings";
const CALENDAR_ID = "wafadentalclinics@gmail.com";
const TIMEZONE = "Asia/Karachi";

// === MAIN FUNCTION: HANDLE FORM SUBMISSION ===
function doPost(e) {
  try {
    const data = e.parameter;
    Logger.log("Received data: " + JSON.stringify(data));

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

    const clientId = generateDeterministicClientId(data);
    const clientRow = findClientRowByClientId(sheet, clientId);
    
    if (clientRow) {
      Logger.log(`Returning client found. Client ID: ${clientId}`);
    } else {
      Logger.log(`New client detected. Generating new Client ID: ${clientId}`);
    }

    const requestedSlotKey = `${data.Date} ${data.Time}`;
    const bookedCounts = getBookedSlotsCount(sheet);
    const currentBookings = bookedCounts[requestedSlotKey] || 0;
    const MAX_BOOKINGS_PER_SLOT = 2;

    if (currentBookings >= MAX_BOOKINGS_PER_SLOT) {
      Logger.log(`Slot unavailable. Requested: ${requestedSlotKey}, Found: ${currentBookings}`);
      throw new Error("Time slot not available. Please choose a different time.");
    }

    const bookingID = generateBookingID(sheet);
    const fullName = `${data.FirstName} ${data.LastName}`;

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const startTime = new Date(`${data.Date} ${data.Time}`);
    const endTime = new Date(startTime.getTime() + 30 * 60000);
    const calendarEvent = calendar.createEvent(
      `${bookingID} - ${fullName} - ${data.Service}`,
      startTime,
      endTime,
      { description: data.Notes || '' }
    );
    const calendarEventId = calendarEvent.getId();

    const pdfResult = generatePremiumPDF(bookingID, clientId, data);

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
      `https://drive.google.com/uc?export=download&id=${pdfResult.fileId}`,
      new Date()
    ]);

    // Send email confirmation
    sendBookingConfirmation(data, bookingID, clientId, pdfResult.fileId);

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

function testAndAuthorize() {
  try {
    Logger.log("Starting permission test...");
    const folder = DriveApp.getRootFolder();
    Logger.log("Successfully accessed root folder: " + folder.getName());
    SpreadsheetApp.getUi().alert("Success! Permissions for Google Drive have been granted.");
    Logger.log("Permission test successful.");
  } catch (e) {
    Logger.log("Error while testing DriveApp permissions: " + e.message);
    SpreadsheetApp.getUi().alert("An error occurred. Error: " + e.message);
  }
}

function generateDeterministicClientId(data) {
  const identifierString = `${data.FirstName.trim()}${data.LastName.trim()}${data.Email.trim()}${data.Phone.trim()}`.toLowerCase();
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identifierString);
  let hexString = '';
  for (let i = 0; i < hash.length; i++) {
    let byte = hash[i];
    if (byte < 0) byte += 256;
    const hex = byte.toString(16);
    if (hex.length === 1) hexString += '0';
    hexString += hex;
  }
  return `WDC-${hexString.substring(0, 10).toUpperCase()}`;
}

function findClientRowByClientId(sheet, clientId) {
  const data = sheet.getRange("A:A").getValues();
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === clientId) return i + 1;
  }
  return null;
}

function generateBookingID(sheet) {
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  const lastRow = sheet.getLastRow();
  let lastNum = 0;
  if (lastRow > 1) {
    const lastBookingID = sheet.getRange(lastRow, 2).getValue();
    const parts = String(lastBookingID).split('-');
    if (parts.length > 2) lastNum = parseInt(parts[2], 10);
  }
  const nextNum = (lastNum + 1).toString().padStart(4, '0');
  return `WAFA-${dateStr}-${nextNum}`;
}

// === UTILITY: Generate PREMIUM PDF Confirmation (FINAL VERSION) ===
function generatePremiumPDF(bookingID, clientID, data) {
  const fullName = `${data.FirstName} ${data.LastName}`;
  const notes = data.Notes || ""; // Handle case where notes are empty
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WAFA Dental Clinic - Booking Confirmation</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; background-color: #ffffff; font-family: 'Inter', sans-serif; color: #333; -webkit-print-color-adjust: exact; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 15mm; box-sizing: border-box; display: flex; flex-direction: column; border: 1px solid #eee; }
        .header { text-align: center; border-bottom: 2px solid #010245; padding-bottom: 10mm; margin-bottom: 10mm; }
        .header h1 { font-family: 'DM Serif Display', serif; font-size: 28pt; color: #010245; margin: 0; line-height: 1.2; }
        .header h2 { font-family: 'Inter', sans-serif; font-weight: 500; font-size: 11pt; color: #555; margin: 2mm 0 0; }
        .header p { font-size: 10pt; color: #666; margin: 1mm 0 0; }
        .section { margin-bottom: 10mm; }
        .section-title { font-family: 'DM Serif Display', serif; font-size: 16pt; color: #010245; border-bottom: 1px solid #e0e0e0; padding-bottom: 2mm; margin-bottom: 5mm; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 8mm; }
        .detail-item strong { display: block; font-size: 9pt; color: #888; margin-bottom: 1mm; text-transform: uppercase; letter-spacing: 0.5px; }
        .detail-item span { font-size: 12pt; color: #010245; font-weight: 500; }
        .notes-section { margin-top: 10mm; }
        .notes-section p { font-size: 12pt; color: #010245; font-weight: 500; background-color: #f8f9fa; padding: 4mm; border-radius: 8px; min-height: 15mm; }
        .notice { background-color: #f0f4ff; border-left: 4px solid #4c4e9e; padding: 4mm; margin-top: 10mm; border-radius: 8px; font-size: 10pt; color: #334; }
        .content-body { flex-grow: 1; }
        .footer { text-align: center; font-size: 8pt; color: #aaa; border-top: 1px solid #eee; padding-top: 5mm; margin-top: auto; }
        .footer a { color: #010245; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <h1>WAFA Dental Clinic</h1>
          <h2>Never Too Late to Improve Your Smile!</h2>
          <p>Official Medical Receipt & Appointment Confirmation</p>
        </div>
        <div class="content-body">
          <div class="section">
            <h3 class="section-title">Patient Details</h3>
            <div class="details-grid">
              <div class="detail-item"><strong>Client ID:</strong><span>${clientID}</span></div>
              <div class="detail-item"><strong>Patient Name:</strong><span>${fullName}</span></div>
              <div class="detail-item"><strong>Email:</strong><span>${data.Email}</span></div>
              <div class="detail-item"><strong>Phone:</strong><span>${data.Phone}</span></div>
            </div>
          </div>
          <div class="section">
            <h3 class="section-title">Appointment Information</h3>
            <div class="details-grid">
              <div class="detail-item"><strong>Booking ID:</strong><span>${bookingID}</span></div>
              <div class="detail-item"><strong>Service:</strong><span>${data.Service}</span></div>
              <div class="detail-item"><strong>Date:</strong><span>${data.Date}</span></div>
              <div class="detail-item"><strong>Time:</strong><span>${data.Time}</span></div>
            </div>
          </div>
          ${notes ? `
          <div class="section notes-section">
            <h3 class="section-title">Other / Previous Issues</h3>
            <p>${notes}</p>
          </div>
          ` : ''}
          <div class="notice">
            <strong>Important:</strong> Please arrive 15 minutes prior to your scheduled appointment. For any changes or cancellations, kindly contact us at least 24 hours in advance.
          </div>
        </div>
        <div class="footer">
          Office #7, 3rd Floor, The Ark Building, I-8 Markaz, Islamabad, Pakistan<br/>
          <a href="https://www.wafadentalclinic.com">www.wafadentalclinic.com</a> | +92 51 8448877
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

// === NEW FUNCTION: SEND BOOKING CONFIRMATION EMAIL ===
function sendBookingConfirmation(clientData, bookingID, clientID, pdfFileId) {
  try {
    const pdfBlob = DriveApp.getFileById(pdfFileId).getBlob();
    const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

    const emailPayload = {
      from: "Wafa Dental Clinic <management@wafadentalclinic.com>",
      to: [clientData.Email],
      subject: `Booking Confirmed - ${bookingID}`,
      html: `
        <html>
          <body>
            <h2>Booking Confirmation</h2>
            <p>Dear ${clientData.FirstName} ${clientData.LastName},</p>
            <p>Your booking is confirmed. Please find the details below:</p>
            <ul>
              <li><strong>Booking ID:</strong> ${bookingID}</li>
              <li><strong>Client ID:</strong> ${clientID}</li>
              <li><strong>Service:</strong> ${clientData.Service}</li>
              <li><strong>Date:</strong> ${clientData.Date}</li>
              <li><strong>Time:</strong> ${clientData.Time}</li>
            </ul>
            <p>Your PDF receipt is attached to this email.</p>
            <p>Thank you for choosing Wafa Dental Clinic.</p>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `${bookingID}.pdf`,
          content: pdfBase64,
        },
      ],
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      payload: JSON.stringify(emailPayload),
    };

    const response = UrlFetchApp.fetch("https://api.resend.com/emails", options);
    Logger.log("Resend API Response: " + response.getContentText());
  } catch (error) {
    Logger.log("Failed to send confirmation email: " + error.toString());
  }
}
