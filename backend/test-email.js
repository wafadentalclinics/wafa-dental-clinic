// Load environment variables from .env file
require('dotenv').config({ path: __dirname + '/.env' });

const sendConfirmationEmail = require('./services/emailService');

// --- Configuration for the test email ---
const testBookingDetails = {
  clientName: 'Test Patient',
  clientEmail: 'test@example.com', // IMPORTANT: Change this to a real email address you can check
  service: 'Test Service',
  date: '2025-09-22',
  time: '05:00 PM',
  additionalInfo: 'This is a test email to verify SMTP settings.'
};

// A dummy PDF buffer for the attachment
const dummyPdfBuffer = Buffer.from('This is a test PDF.');

/**
 * An asynchronous IIFE (Immediately Invoked Function Expression) to run the test.
 */
(async () => {
  console.log('--- Starting Email Service Test ---');
  
  // Validate that all required environment variables are present
  const requiredEnvVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('Error: Missing required environment variables:', missingVars.join(', '));
    console.log('Please ensure you have a .env file in the /backend directory with all the required values.');
    return; // Exit if variables are missing
  }

  console.log(`Attempting to send a test email to: ${testBookingDetails.clientEmail}`);
  console.log('Using SMTP Host:', process.env.SMTP_HOST);
  console.log('Using SMTP User:', process.env.SMTP_USER);

  try {
    await sendConfirmationEmail(testBookingDetails, dummyPdfBuffer);
    console.log('--- Test Email Sent Successfully! ---');
    console.log('Please check the inbox of the recipient email address.');
  } catch (error) {
    console.error('--- Failed to Send Test Email ---');
    console.error('Error details:', error);
  }
})();
