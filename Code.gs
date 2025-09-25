// === CONFIGURATION ===
const RESEND_API_KEY = PropertiesService.getScriptProperties().getProperty('RESEND_API_KEY');
const SHEET_NAME = "WAFA Bookings";
const EMAIL_QUEUE_SHEET_NAME = "Email Queue";
const CALENDAR_ID = "wafadentalclinics@gmail.com";
const TIMEZONE = "Asia/Karachi";

// === MAIN FUNCTION: HANDLE FORM SUBMISSION ===
function doPost(e) {
  try {
    // Parse the JSON payload from the request body
    const postData = JSON.parse(e.postData.contents);
    const data = postData.parameter;
    Logger.log("Received data for doPost: " + JSON.stringify(data));

    // Validate incoming data
    if (!data.FirstName || !data.LastName || !data.Email || !data.Phone || !data.Service || !data.Date || !data.Time) {
      throw new Error("Missing required booking information.");
    }

    let spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
    } catch (sheetError) {
      throw new Error("Could not open the spreadsheet. Please check the URL and permissions.");
    }

    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet with name "${SHEET_NAME}" not found.`);
    }

    const clientId = generateDeterministicClientId_(data);
    const bookingID = generateBookingID_(sheet);
    const fullName = `${data.FirstName} ${data.LastName}`;

    let calendarEventId;
    try {
      const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
      const startTime = new Date(`${data.Date} ${data.Time}`);
      const endTime = new Date(startTime.getTime() + 30 * 60000);
      const calendarEvent = calendar.createEvent(
        `${bookingID} - ${fullName} - ${data.Service}`,
        startTime,
        endTime,
        { description: data.Notes || '' }
      );
      calendarEventId = calendarEvent.getId();
    } catch (calendarError) {
      throw new Error("Failed to create calendar event. Please check calendar permissions.");
    }
    
    let pdfResult;
    try {
      pdfResult = generatePremiumPDF_(bookingID, clientId, data);
    } catch (pdfError) {
      throw new Error("Failed to generate PDF. Please check Drive permissions.");
    }

    try {
      sheet.appendRow([
        clientId, bookingID, fullName, data.Email, `'${data.Phone}`,
        data.Service, data.Date, data.Time, calendarEventId, 
        `https://drive.google.com/uc?export=download&id=${pdfResult.fileId}`, new Date()
      ]);
    } catch (appendError) {
      throw new Error("Failed to write to the spreadsheet. Please check sheet permissions.");
    }

    queueEmail_(spreadsheet, pdfResult.fileId, data, bookingID, clientId);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      bookingID: bookingID,
      clientID: clientId,
      pdfBase64: pdfResult.base64
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("CRITICAL Error in doPost: " + err.message + " Stack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "An internal error occurred: " + err.message }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// === BACKGROUND FUNCTION: PROCESS THE EMAIL QUEUE ===
function processEmailQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
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
      const rowNumber = i + 2;
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
          html: getEmailHtml_({
            clientName: `${firstName} ${lastName}`,
            service: service,
            date: date,
            time: time
          }),
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
        queueSheet.getRange(rowNumber, 12).setValue(error.toString().substring(0, 500));
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// === HELPER FUNCTIONS ===

function queueEmail_(spreadsheet, fileId, data, bookingID, clientId) {
  let sheet = spreadsheet.getSheetByName(EMAIL_QUEUE_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(EMAIL_QUEUE_SHEET_NAME);
    sheet.appendRow(["File ID", "Recipient", "First Name", "Last Name", "Service", "Date", "Time", "Booking ID", "Client ID", "Status", "Attempts", "Last Response"]);
  }
  sheet.appendRow([
    fileId, data.Email, data.FirstName, data.LastName, data.Service, data.Date, `'${data.Time}`,
    bookingID, clientId, "QUEUED", 0, ""
  ]);
}

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
  return {
    fileId: file.getId(),
    base64: Utilities.base64Encode(pdf.getBytes()),
    pdfBlob: pdf
  };
}

function getBookedSlotsCount_(sheet) {
  const allData = sheet.getDataRange().getValues();
  const bookedSlotsCount = {};
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const dateValue = row[6];
    const time = row[7];
    if (dateValue instanceof Date && time) {
      const formattedDate = Utilities.formatDate(new Date(dateValue), TIMEZONE, "MM/dd/yyyy");
      const slotKey = `${formattedDate} ${time}`;
      bookedSlotsCount[slotKey] = (bookedSlotsCount[slotKey] || 0) + 1;
    }
  }
  return bookedSlotsCount;
}

function doGet(e) {
  try {
    if (e.parameter.action === 'getBookedSlots') {
      const spreadsheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit");
      const sheet = spreadsheet.getSheetByName(SHEET_NAME);
      const bookedSlots = getBookedSlotsCount_(sheet);
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

function getEmailHtml_(bookingDetails) {
  const { clientName, service, date, time } = bookingDetails;
  const primaryColor = '#010245';
  const logoUrl = 'https://www.wafadentalclinic.com/images/logo.png';

  const bookingDate = new Date(date);
  const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = `${bookingDate.getDate()}th ${bookingDate.toLocaleDateString('en-US', { month: 'long' })} ${bookingDate.getFullYear()}, ${dayOfWeek}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f4f7f6; color: #333; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 18px rgba(0,0,0,0.05); }
        .header { display: flex; align-items: center; padding: 20px 30px; background-color: ${primaryColor}; color: #ffffff; }
        .header img { width: 35px; height: 35px; margin-right: 15px; }
        .header-text { text-align: left; }
        .header-text h1 { font-family: 'DM Serif Display', serif; font-size: 24px; margin: 0; }
        .header-text p { font-family: 'Inter', sans-serif; margin: 4px 0 0; font-size: 16px; }
        .content { padding: 30px; line-height: 1.7; }
        .content h2 { font-size: 20px; color: ${primaryColor}; margin-top: 0; }
        .booking-details { background-color: #f9f9f9; border-left: 4px solid ${primaryColor}; padding: 20px; margin: 25px 0; }
        .booking-details p { margin: 12px 0; font-size: 16px; }
        .policy { background-color: #e3f2fd; border: 1px solid #bbdefb; padding: 20px; border-radius: 8px; }
        .location a.button { background-color: #000000; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500; }
        .footer { background-color: #333333; color: #cccccc; text-align: center; padding: 25px; font-size: 12px; }
        .footer a { color: #ffffff; text-decoration: none; }
        .social-links a { margin: 0 8px; }
        .social-links img { width: 20px; height: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Wafa Dental Clinic Logo">
          <div class="header-text">
            <h1>WAFA Dental Clinic</h1>
            <p>Your Booking is Confirmed!</p>
          </div>
        </div>
        <div class="content">
          <h2>Dear ${clientName},</h2>
          <p>Thank you for choosing Wafa Dental Clinic. We are pleased to confirm your appointment. Your e-receipt is attached.</p>
          <div class="booking-details">
            <p><strong>Service:</strong> ${service}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${time}</p>
          </div>
          <div class="policy">
            <p><strong>Cancellation & Rescheduling Policy:</strong> If you need to cancel or reschedule, please contact us at least 24 hours in advance at <a href="tel:+92518448877">+92 51 8448877</a> or on WhatsApp at <a href="https://wa.me/923295195096">+92 329 5195096</a>.</p>
          </div>
          <div class="location" style="margin-top: 25px;">
            <p><strong>Our Location:</strong><br>Office #7, 3rd Floor, The Ark Building, Markaz, I-8, Islamabad, 44000, Pakistan</p>
            <a href="https://www.google.com/maps/place/WAFA+Dental+Clinic/@33.6673337,73.0747596,17z" class="button" target="_blank">Get Directions on Google Maps ↗</a>
          </div>
        </div>
        <div class="footer">
          <div class="social-links" style="margin-bottom: 15px;">
            <a href="https://www.facebook.com/wafadentalclinics"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" alt="Facebook"></a>
            <a href="https://www.instagram.com/wafadentalclinic.pk/"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png" alt="Instagram"></a>
            <a href="https://x.com/TeamWafaDental"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx.png" alt="Twitter"></a>
            <a href="https://www.linkedin.com/company/wafa-dental-clinic/"><img src="https://img.icons8.com/ios-filled/50/ffffff/linkedin.png" alt="LinkedIn"></a>
          </div>
          <p>Wafa Dental Clinic | +92 51 8448877 | <a href="mailto:management@wafadentalclinic.com">management@wafadentalclinic.com</a></p>
          <p>&copy; ${new Date().getFullYear()} Wafa Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
