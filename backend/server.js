// Load environment variables from .env file
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const { sendEmail, getAppointmentReminderTemplate } = require('./services/resendEmailService');
const generateConfirmationPdf = require('./services/pdfService');

// Initialize the Express application
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * POST /send-confirmation
 * Endpoint to send a booking confirmation email with a PDF attachment.
 *
 * Request Body:
 * {
 *   "clientName": "string",
 *   "clientEmail": "string",
 *   "service": "string",
 *   "date": "string",
 *   "time": "string",
 *   "additionalInfo": "string"
 * }
 */
app.post('/send-confirmation', async (req, res) => {
  console.log('[/send-confirmation] Endpoint hit at:', new Date().toISOString());
  console.log('Received payload:', JSON.stringify(req.body, null, 2));

  // Destructure and validate the request body
  const { clientName, clientEmail, service, date, time, additionalInfo, bookingId, clientId } = req.body;

  if (!clientName || !clientEmail || !service || !date || !time) {
    console.error('Validation failed: Missing required booking information.');
    return res.status(400).json({ success: false, message: 'Missing required booking information.' });
  }

  const bookingDetails = { clientName, clientEmail, service, date, time, additionalInfo, bookingId, clientId };

  try {
    // 1. Generate the PDF confirmation using the backend service
    console.log('Generating PDF e-receipt...');
    const pdfBuffer = await generateConfirmationPdf(bookingDetails);
    console.log('PDF generated successfully. Buffer length:', pdfBuffer.length);

    // 2. Prepare the email content
    const emailHtml = getAppointmentReminderTemplate({ name: clientName, appointmentDate: date, appointmentTime: time, service, bookingId, clientId });
    const subject = `Your Appointment Confirmation with WAFA Dental Clinic`;
    const attachments = [{
        filename: `WAFA_Dental_Clinic_Receipt_${bookingId || 'CONFIRMATION'}.pdf`,
        content: pdfBuffer,
    }];

    // 3. Send the confirmation email with the PDF attachment
    console.log(`Attempting to send email via Resend to: ${clientEmail}...`);
    const emailSent = await sendEmail(clientEmail, subject, emailHtml, attachments);

    if (!emailSent) {
      throw new Error('Failed to send confirmation email via Resend.');
    }
    
    console.log('Email sent successfully.');

    // 4. Send a success response
    res.status(200).json({ success: true, message: 'Booking confirmation email with PDF sent successfully!' });
  } catch (error) {
    // Log the error and send a failure response
    console.error('Failed to send confirmation email:', error);
    res.status(500).json({ success: false, message: 'An error occurred while sending the confirmation email.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
