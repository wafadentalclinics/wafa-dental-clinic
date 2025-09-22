// Load environment variables from .env file
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const { sendEmail, getAppointmentReminderTemplate } = require('./services/resendEmailService');

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
  // Destructure and validate the request body
  const { clientName, clientEmail, service, date, time, bookingId, clientId, pdfBase64 } = req.body;

  if (!clientName || !clientEmail || !service || !date || !time || !bookingId || !clientId || !pdfBase64) {
    return res.status(400).json({ success: false, message: 'Missing required booking information.' });
  }

  const bookingDetails = { name: clientName, clientEmail, service, appointmentDate: date, appointmentTime: time, bookingId, clientId };

  try {
    // 1. Decode the Base64 PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // 2. Prepare the email content
    const emailHtml = getAppointmentReminderTemplate(bookingDetails);
    const subject = `Booking Confirmed: Your Appointment for ${service}`;
    const attachments = [{
        filename: `WAFA_Dental_Clinic_Booking_${bookingId}.pdf`,
        content: pdfBuffer,
    }];

    // 3. Send the confirmation email with the PDF attachment
    console.log(`Sending confirmation email to ${clientEmail}...`);
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
