// Load environment variables from .env file
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const sendConfirmationEmail = require('./services/emailService');
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
  // Destructure and validate the request body
  const { clientName, clientEmail, service, date, time, additionalInfo } = req.body;

  if (!clientName || !clientEmail || !service || !date || !time) {
    return res.status(400).json({ success: false, message: 'Missing required booking information.' });
  }

  const bookingDetails = { clientName, clientEmail, service, date, time, additionalInfo };

  try {
    // 1. Generate the PDF confirmation
    console.log('Generating PDF...');
    const pdfBuffer = await generateConfirmationPdf(bookingDetails);
    console.log('PDF generated successfully.');

    // 2. Send the confirmation email with the PDF attachment
    console.log(`Sending confirmation email to ${clientEmail}...`);
    await sendConfirmationEmail(bookingDetails, pdfBuffer);
    console.log('Email sent successfully.');

    // 3. Send a success response
    res.status(200).json({ success: true, message: 'Booking confirmation email sent successfully!' });
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
