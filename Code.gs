// === CONFIGURATION ===
const RESEND_API_KEY = "re_BtcZWuVZ_NJhAQBudfFufERALf1aXQQAk"; // Use your Backend API Key
const SHEET_NAME = "WAFA Bookings";
const EMAIL_QUEUE_SHEET_NAME = "Email Queue";
const CALENDAR_ID = "wafadentalclinics@gmail.com";
const TIMEZONE = "Asia/Karachi";

// === MAIN FUNCTION: HANDLE FORM SUBMISSION ===
function doPost(e) {
  try {
    const data = e.parameter;
    Logger.log("Received data for doPost: " + JSON.stringify(data));

    const spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    const clientId = generateDeterministicClientId_(data);
    const bookingID = generateBookingID_(sheet);
    
    // Create Calendar Event, PDF, etc.
    // Note: Calendar event creation is omitted for brevity but should be here in your full script.
    const pdfResult = generatePremiumPDF_(bookingID, clientId, data);

    sheet.appendRow([
      clientId, bookingID, `${data.FirstName} ${data.LastName}`, data.Email, `'${data.Phone}`,
      data.Service, data.Date, data.Time, /* calendarEventId */, 
      `https://drive.google.com/uc?export=download&id=${pdfResult.fileId}`, new Date()
    ]);

    queueEmail_(spreadsheet, pdfResult.fileId, data, bookingID, clientId);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      bookingID: bookingID,
      clientID: clientId,
      pdfBase64: pdfResult.base64
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("CRITICAL Error in doPost: " + err.message + " Stack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// === NEW, ROBUST BACKGROUND FUNCTION: PROCESS THE EMAIL QUEUE ===
function processEmailQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { // Increased lock timeout
    Logger.log("Could not acquire lock; another process is running.");
    return;
  }

  try {
    const spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
    const queueSheet = spreadsheet.getSheetByName(EMAIL_QUEUE_SHEET_NAME);
    if (!queueSheet || queueSheet.getLastRow() < 2) {
      Logger.log("Email queue is empty.");
      return;
    }

    const dataRange = queueSheet.getRange("A2:L" + queueSheet.getLastRow());
    const data = dataRange.getValues();

    for (let i = 0; i < data.length; i++) {
      const rowNumber = i + 2; // Sheet rows are 1-indexed, and we start from row 2
      let [fileId, email, firstName, lastName, service, date, time, bookingId, clientId, status, attempts, lastResponse] = data[i];
      
      if (status === "SENT" || attempts >= 5) {
        continue;
      }

      const currentAttempt = (Number(attempts) || 0) + 1;
      
      try {
        const pdfBlob = DriveApp.getFileById(fileId).getBlob();
        const pdfBase64 = Utilities.base64Encode(pdfBlob.getBytes());

        const emailPayload = {
          from: "Wafa Dental Clinic <management@wafadentalclinic.com>",
          to: [email],
          subject: `Booking Confirmed - ${bookingId}`,
          html: `<html><body><h2>Booking Confirmation</h2><p>Dear ${firstName} ${lastName},</p><p>Your booking is confirmed. Details are in the attached PDF.</p></body></html>`,
          attachments: [{ filename: `${bookingId}.pdf`, content: pdfBase64 }],
        };

        const options = {
          method: "post",
          contentType: "application/json",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
          payload: JSON.stringify(emailPayload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch("https://api.resend.com/emails", options);
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();

        if (responseCode >= 200 && responseCode < 300) {
          queueSheet.getRange(rowNumber, 10).setValue("SENT");
          queueSheet.getRange(rowNumber, 12).setValue(`Success (${responseCode}): ${responseBody}`);
          Logger.log(`Email sent to ${email}. Response: ${responseBody}`);
        } else {
          throw new Error(`Resend API Error (${responseCode}): ${responseBody}`);
        }
      } catch (error) {
        Logger.log(`Failed to process email for ${email}: ${error.toString()}`);
        queueSheet.getRange(rowNumber, 10).setValue("FAILED");
        queueSheet.getRange(rowNumber, 11).setValue(currentAttempt);
        queueSheet.getRange(rowNumber, 12).setValue(error.toString().substring(0, 500)); // Prevent cell overflow
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// === HELPER & TEST FUNCTIONS ===

function queueEmail_(spreadsheet, fileId, data, bookingID, clientId) {
  let sheet = spreadsheet.getSheetByName(EMAIL_QUEUE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(EMAIL_QUEUE_SHEET_NAME);
    sheet.appendRow(["File ID", "Recipient", "First Name", "Last Name", "Service", "Date", "Time", "Booking ID", "Client ID", "Status", "Attempts", "Last Response"]);
  }
  sheet.appendRow([
    fileId, data.Email, data.FirstName, data.LastName, data.Service, data.Date, data.Time,
    bookingID, clientId, "QUEUED", 0, ""
  ]);
}

// --- TEST FUNCTIONS ---
function testResendSimpleEmail() {
  const payload = {
    from: "Wafa Dental Clinic <management@wafadentalclinic.com>",
    to: ["your-real-email@example.com"], // <-- IMPORTANT: CHANGE THIS
    subject: "Simple Email Test",
    html: "<h1>Success!</h1><p>This is a simple test from Google Apps Script.</p>"
  };
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch("https://api.resend.com/emails", options);
  Logger.log(`Response Code: ${response.getResponseCode()}`);
  Logger.log(`Response Body: ${response.getContentText()}`);
}

function testResendWithAttachment() {
  const dummyHtml = "<html><body><h1>Test PDF</h1><p>This is a test attachment.</p></body></html>";
  const dummyBlob = Utilities.newBlob(dummyHtml, 'text/html').getAs('application/pdf');
  const pdfBase64 = Utilities.base64Encode(dummyBlob.getBytes());

  const payload = {
    from: "Wafa Dental Clinic <management@wafadentalclinic.com>",
    to: ["your-real-email@example.com"], // <-- IMPORTANT: CHANGE THIS
    subject: "Attachment Test",
    html: "<h1>Success!</h1><p>This email should contain a PDF attachment.</p>",
    attachments: [{ filename: "test.pdf", content: pdfBase64 }]
  };
  const options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch("https://api.resend.com/emails", options);
  Logger.log(`Response Code: ${response.getResponseCode()}`);
  Logger.log(`Response Body: ${response.getContentText()}`);
}

// --- Other Helper Functions ---
function generateDeterministicClientId_(data) {
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

function generateBookingID_(sheet) {
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

function generatePremiumPDF_(bookingID, clientID, data) {
  const fullName = `${data.FirstName} ${data.LastName}`;
  const notes = data.Notes || "";
  const htmlContent = `<!DOCTYPE html><html>... (your PDF HTML) ...</html>`; // Truncated for brevity
  const blob = Utilities.newBlob(htmlContent, 'text/html', `${bookingID}.html`);
  const pdf = blob.getAs('application/pdf').setName(`${bookingID}.pdf`);
  const file = DriveApp.createFile(pdf);
  return {
    fileId: file.getId(),
    base64: Utilities.base64Encode(pdf.getBytes()),
    pdfBlob: pdf
  };
}

function getBookedSlotsCount_(sheet) {
  // ... (logic remains the same) ...
  return {};
}

function doGet(e) {
  // ... (logic remains the same) ...
}
