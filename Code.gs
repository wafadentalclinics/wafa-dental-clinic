// === CONFIGURATION ===
const SHEET_NAME = "WAFA Bookings"; // Correct tab name
const CALENDAR_ID = "wafadentalclinics@gmail.com"; // WAFA Dental Clinic calendar
const TIMEZONE = "Asia/Karachi"; // Changed to Asia/Karachi

// === HANDLE FORM SUBMISSION ===
function doPost(e) {
  try {
    // Log the raw e object for debugging
    Logger.log("Raw e object: " + JSON.stringify(e));
    Logger.log("e.parameter: " + JSON.stringify(e.parameter));

    // Data will now be in e.parameter if sent as URL-encoded form data
    const data = e.parameter;

    // Validate required fields
    const requiredFields = ['FirstName','LastName','Email','Phone','Service','Date','Time'];
    for(const field of requiredFields){
      if(!data[field] || String(data[field]).trim() === '') { // Use String() for robustness
        return ContentService.createTextOutput(JSON.stringify({success:false, message:`${field} is required.`}))
                             .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    const fullName = `${data.FirstName} ${data.LastName}`;

    const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit";
    Logger.log("Attempting to open spreadsheet with URL: " + spreadsheetUrl);
    const spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    Logger.log("Spreadsheet object after openByUrl: " + (spreadsheet ? "Successfully opened" : "NULL"));

    if (!spreadsheet) {
      throw new Error("Failed to open spreadsheet by URL. Check URL and permissions.");
    }

    const sheets = spreadsheet.getSheets();
    const sheetNames = sheets.map(s => s.getName());
    Logger.log("Found sheets in spreadsheet: " + JSON.stringify(sheetNames));

    Logger.log("Attempting to get sheet by name: " + SHEET_NAME);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    Logger.log("Sheet object after getSheetByName: " + (sheet ? "Successfully found" : "NULL"));

    if (!sheet) {
      throw new Error(`Sheet named "${SHEET_NAME}" not found in the spreadsheet. Check sheet name and permissions.`);
    }

    // --- Step 1: Check for existing patient and generate Client ID ---
    const allData = sheet.getDataRange().getValues();
    let clientID = null;
    // Assuming "Client ID" is column 1 (index 0), "Name" is column 3 (index 2), "Email" is column 4 (index 3)
    for(let i=1;i<allData.length;i++){ // Start from 1 to skip header row
      const row = allData[i];
      if(row[2] === fullName && row[3] === data.Email){ // Check against Name and Email columns
        clientID = row[0]; // Get existing "Client ID" from the first column
        break;
      }
    }
    if(!clientID){
      clientID = generateClientID(sheet);
    }
    
    // --- Step 2: Check Slot Availability ---
    const requestedSlotKey = `${data.Date} ${data.Time}`;
    const bookedCounts = getBookedSlotsCount();
    const currentBookings = bookedCounts[requestedSlotKey] || 0;
    const MAX_BOOKINGS_PER_SLOT = 2; // Define the maximum allowed bookings per slot

    if (currentBookings >= MAX_BOOKINGS_PER_SLOT) {
      return ContentService.createTextOutput(JSON.stringify({success:false, message:"Time slot not available. Please choose a different time."}))
                           .setMimeType(ContentService.MimeType.JSON);
    }

    // --- Step 3: Generate Booking ID ---
    const bookingID = generateBookingID(sheet);
    
    // --- Step 4: Create Calendar Event ---
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const startTime = new Date(data.Date + " " + data.Time);
    const endTime = new Date(startTime.getTime() + 30*60000); // 30 min appointment
    const calendarEvent = calendar.createEvent(
      bookingID + " - " + fullName + " - " + data.Service, // Removed '+' before data.Service
      startTime,
      endTime,
      {description: data.Notes || ''} // Include notes in calendar description
    );
    const calendarEventId = calendarEvent.getId();
    
    // --- Step 4: Generate downloadable PDF ---
    // MODIFIED: Get file ID instead of URL
    const pdfFileId = generatePDF(bookingID, clientID, data);

    // --- Step 5: Append booking to Sheet ---
    // The order of items must match your Google Sheet's columns:
    // ["Client ID","Booking ID","Name","Email","Phone","Service","Date","Time","Calendar Event ID","Doc URL","Created At"]
    sheet.appendRow([
      clientID,          // Column 1: Client ID
      bookingID,         // Column 2: Booking ID
      fullName,          // Column 3: Name (FirstName + LastName)
      data.Email,        // Column 4: Email
      `'${data.Phone}`,  // MODIFIED: Prepend with ' to force text format
      data.Service,      // Column 6: Service
      data.Date,         // Column 7: Date
      data.Time,         // Column 8: Time
      calendarEventId,   // Column 9: Calendar Event ID
      `https://drive.google.com/uc?export=download&id=${pdfFileId}`, // Column 10: Doc URL (direct download link)
      new Date()         // Column 11: Created At
    ]);
    
    // MODIFIED: Get file ID instead of URL
    const pdfBase64 = generatePDF(bookingID, clientID, data); // Capture the base64 string

    // MODIFIED: Return pdfFileId, bookingID, clientID, AND pdfBase64
    return ContentService.createTextOutput(JSON.stringify({success:true, pdfFileId: pdfFileId, bookingID: bookingID, clientID: clientID, pdfBase64: pdfBase64}))
                         .setMimeType(ContentService.MimeType.JSON);
    
  } catch(err){
    Logger.log("Error in doPost: " + err.message + " Stack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// === UTILITY: Generate Booking ID ===
function generateBookingID(sheet){
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  const lastRow = sheet.getLastRow();
  let lastNum = 0;
  if(lastRow > 1){
    // Assuming Booking ID is in column 2 (index 1)
    const lastBookingID = sheet.getRange(lastRow, 2).getValue();
    const parts = String(lastBookingID).split('-'); // Ensure it's a string before split
    if(parts.length > 2) lastNum = parseInt(parts[2],10);
  }
  const nextNum = (lastNum + 1).toString().padStart(4,'0');
  return "WAFA-" + dateStr + "-" + nextNum;
}

// === UTILITY: Generate Client ID ===
function generateClientID(sheet){
  const lastRow = sheet.getLastRow();
  let lastNum = 0;
  if(lastRow > 1){
    // Assuming Client ID is in column 1 (index 0)
    const lastClientID = sheet.getRange(lastRow, 1).getValue();
    if(lastClientID){
      lastNum = parseInt(String(lastClientID).replace("C-",""),10); // Ensure it's a string
    }
  }
  const nextNum = (lastNum + 1).toString().padStart(4,'0');
  return "C-" + nextNum;
}

// === UTILITY: Generate PDF Confirmation ===
function generatePDF(bookingID, clientID, data){
  const fullName = `${data.FirstName} ${data.LastName}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WAFA Dental Clinic - Medical Receipt</title>
      <style>
        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background-color: #f8f9fa; color: #343a40; }
        .receipt-container {
          width: 100%;
          max-width: 700px;
          margin: 30px auto;
          background-color: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }
        .header {
          background-color: #010245; /* Primary Blue */
          color: #ffffff;
          padding: 25px 30px;
          text-align: center;
          border-bottom: 5px solid #4c4e9e; /* Accent Blue */
        }
        .header h1 {
          font-family: 'DM Serif Display', serif;
          font-size: 32px;
          margin: 0;
          line-height: 1.2;
        }
        .header p {
          font-size: 15px;
          margin: 5px 0 0;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .section-title {
          font-family: 'DM Serif Display', serif;
          font-size: 24px;
          color: #010245;
          margin-top: 35px;
          margin-bottom: 18px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e9ecef;
        }
        .section-title:first-of-type {
          margin-top: 0;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px 25px;
          margin-bottom: 25px;
        }
        .info-item strong {
          display: block;
          font-size: 13px;
          color: #6c757d;
          margin-bottom: 3px;
        }
        .info-item span {
          font-size: 16px;
          color: #343a40;
          font-weight: 500;
        }
        .notes {
          background-color: #f0f8ff;
          border-left: 4px solid #007bff;
          padding: 15px;
          margin-top: 25px;
          border-radius: 8px;
          font-size: 14px;
          color: #004085;
        }
        .notes strong {
          color: #004085;
        }
        .footer {
          background-color: #f1f3f5;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
          margin-top: 40px;
        }
        .footer a {
          color: #010245;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <h1>WAFA Dental Clinic</h1>
          <p>Your Health, Our Priority</p>
          <p>Official Medical Receipt & Appointment Confirmation</p>
        </div>

        <div class="content">
          <h2 class="section-title">Patient Details</h2>
          <div class="info-grid">
            <div class="info-item">
              <strong>Client ID:</strong>
              <span>${clientID}</span>
            </div>
            <div class="info-item">
              <strong>Patient Name:</strong>
              <span>${fullName}</span>
            </div>
            <div class="info-item">
              <strong>Email:</strong>
              <span>${data.Email}</span>
            </div>
            <div class="info-item">
              <strong>Phone:</strong>
              <span>${data.Phone}</span>
            </div>
          </div>

          <h2 class="section-title">Appointment Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <strong>Booking ID:</strong>
              <span>${bookingID}</span>
            </div>
            <div class="info-item">
              <strong>Service:</strong>
              <span>${data.Service}</span>
            </div>
            <div class="info-item">
              <strong>Date:</strong>
              <span>${data.Date}</span>
            </div>
            <div class="info-item">
              <strong>Time:</strong>
              <span>${data.Time}</span>
            </div>
          </div>

          ${data.Notes ? `<div class="notes"><strong>Notes/Previous Issues:</strong> ${data.Notes}</div>` : ''}

          <div class="notes" style="background-color: #d4edda; border-left-color: #28a745; color: #155724; margin-top: 30px;">
            <strong>Important:</strong> Please arrive 15 minutes prior to your scheduled appointment. For any changes or cancellations, kindly contact us at least 24 hours in advance.
          </div>
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} WAFA Dental Clinic. All rights reserved.
          <br>
          Office #7 · 3rd Floor · The Ark Building · I-8 Markaz · Islamabad 44000 · Pakistan
          <br>
          <a href="https://www.wafadentalclinic.com" target="_blank">www.wafadentalclinic.com</a>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const blob = Utilities.newBlob(htmlContent, 'text/html', bookingID + '.html');
  const pdf = blob.getAs('application/pdf').setName(bookingID + '.pdf');
  
  // Save a copy to Google Drive as requested for the backend
  const file = DriveApp.createFile(pdf); 
  const pdfFileId = file.getId(); // Get the ID of the file saved in Drive

  // Return base64 encoded PDF content for direct download on the frontend
  return Utilities.base64Encode(pdf.getBytes()); 
}

// === UTILITY: Get Booked Slots Count ===
function getBookedSlotsCount() {
  const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPqQLmlMaAPixaI/edit"; // Ensure this URL is correct
  const spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error(`Sheet named "${SHEET_NAME}" not found.`);
  }

  const allData = sheet.getDataRange().getValues();
  const bookedSlotsCount = {};

  // Assuming Date is column 7 (index 6) and Time is column 8 (index 7)
  // Start from 1 to skip header row
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const date = row[6]; // Date column
    const time = row[7]; // Time column
    const slotKey = `${date} ${time}`;

    bookedSlotsCount[slotKey] = (bookedSlotsCount[slotKey] || 0) + 1;
  }
  return bookedSlotsCount;
}

// === UTILITY: Fetch booked slots for real-time availability ===
function doGet(e){
  try {
    // Check if an 'action' parameter is provided, e.g., '?action=getBookedSlots'
    if (e.parameter.action === 'getBookedSlots') {
      const bookedSlots = getBookedSlotsCount();
      return ContentService.createTextOutput(JSON.stringify(bookedSlots))
                           .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Handle other GET requests or return a default response
      return ContentService.createTextOutput(JSON.stringify({success:false, message: "Invalid GET request."}))
                           .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    Logger.log("Error in doGet: " + err.message + " Stack: " + err.stack);
    return ContentService.createTextOutput(JSON.stringify({success:false, message: err.message}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
