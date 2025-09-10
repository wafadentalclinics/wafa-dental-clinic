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
    
    // --- Step 2: Generate Booking ID ---
    const bookingID = generateBookingID(sheet);
    
    // --- Step 3: Create Calendar Event ---
    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const startTime = new Date(data.Date + " " + data.Time);
    const endTime = new Date(startTime.getTime() + 30*60000); // 30 min appointment
    const calendarEvent = calendar.createEvent(
      bookingID + " - " + fullName + " - + " + data.Service,
      startTime,
      endTime,
      {description: data.Notes || ''} // Include notes in calendar description
    );
    const calendarEventId = calendarEvent.getId();
    
    // --- Step 4: Generate downloadable PDF ---
    // MODIFIED: Get base64 encoded PDF content instead of file ID
    const pdfBase64 = generatePDF(bookingID, clientID, data);

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
      `https://drive.google.com/uc?export=download&id=${pdfBase64}`, // Column 10: Doc URL (This will be a placeholder, as we're not using Drive for direct download)
      new Date()         // Column 11: Created At
    ]);
    
    // MODIFIED: Return pdfBase64, bookingID, and clientID
    return ContentService.createTextOutput(JSON.stringify({success:true, pdfBase64: pdfBase64, bookingID: bookingID, clientID: clientID}))
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
      <title>WAFA Dental Clinic - Booking Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { color: #010245; font-size: 28px; margin: 0; }
        .header p { color: #555; font-size: 14px; margin-top: 5px; }
        .section-title { color: #010245; font-size: 20px; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 14px; }
        th { background-color: #f8f8f8; color: #010245; }
        .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #888; }
        .important-note { background-color: #fff3cd; border-left: 5px solid #ffc107; padding: 10px; margin-top: 20px; font-size: 13px; color: #664d03; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>WAFA Dental Clinic</h1>
          <p>Your Health, Our Priority</p>
          <p>Booking Confirmation & E-Receipt</p>
        </div>

        <h2 class="section-title">Appointment Details</h2>
        <table>
          <tr>
            <th>Booking ID:</th>
            <td>${bookingID}</td>
          </tr>
          <tr>
            <th>Client ID:</th>
            <td>${clientID}</td>
          </tr>
          <tr>
            <th>Service:</th>
            <td>${data.Service}</td>
          </tr>
          <tr>
            <th>Date:</th>
            <td>${data.Date}</td>
          </tr>
          <tr>
            <th>Time:</th>
            <td>${data.Time}</td>
          </tr>
          <tr>
            <th>Notes:</th>
            <td>${data.Notes || 'N/A'}</td>
          </tr>
        </table>

        <h2 class="section-title">Patient Information</h2>
        <table>
          <tr>
            <th>Name:</th>
            <td>${fullName}</td>
          </tr>
          <tr>
            <th>Email:</th>
            <td>${data.Email}</td>
          </tr>
          <tr>
            <th>Phone:</th>
            <td>${data.Phone}</td>
          </tr>
        </table>

        <div class="important-note">
          Please keep this receipt for your records. We look forward to seeing you!
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} WAFA Dental Clinic. All rights reserved.
          <br>
          Office #7 · 3rd Floor · The Ark Building · I-8 Markaz · Islamabad 44000 · Pakistan
        </div>
      </div>
    </body>
    </html>
  `;
  
  const blob = Utilities.newBlob(htmlContent, 'text/html', bookingID + '.html');
  const pdf = blob.getAs('application/pdf').setName(bookingID + '.pdf');
  
  // Instead of creating a file in Drive, return the base64 encoded content
  return Utilities.base64Encode(pdf.getBytes());
}

// === UTILITY: Fetch booked slots for real-time availability ===
function doGet(e){
  const sheet = SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/19iITtL0e8U36frY1TIxx7wZoypPrMPzQLmlMaAPixaI/edit").getSheetByName(SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  // Assuming Date is column 7 (index 6) and Time is column 8 (index 7)
  const bookedSlots = allData.slice(1).map(r => r[6] + " " + r[7]); // Date + Time
  return ContentService.createTextOutput(JSON.stringify(bookedSlots))
                       .setMimeType(ContentService.MimeType.JSON);
}
