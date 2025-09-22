/**
 * ==============================================================================
 * RESEND EMAIL SENDING TEST SCRIPT
 * ==============================================================================
 *
 * Description:
 * This script provides a safe way to test the email sending functionality of
 * the resendEmailService.js module. It sends a sample appointment reminder
 * to a specified test recipient.
 *
 * How to Run:
 * 1. Make sure your RESEND_API_KEY is set in the backend/.env file.
 * 2. Update the `TEST_RECIPIENT_EMAIL` variable below to your personal email.
 * 3. Run the script from the root of your project:
 *    node backend/resendTest.js
 *
 * NOTE:
 * While your domain is unverified, Resend requires you to send emails FROM
 * 'onboarding@resend.dev' and TO your own registered email address. This script
 * temporarily modifies the FROM address to comply with this for testing.
 *
 * ==============================================================================
 */

const { sendAppointmentReminder } = require('./services/resendEmailService');
const { Resend } = require('resend');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// --- Configuration ---
// IMPORTANT: Change this to your personal email address for testing.
const TEST_RECIPIENT_EMAIL = 'hammaddsaeed@gmail.com';

// --- Test Data ---
const sampleClient = {
  name: 'Test Client',
  email: TEST_RECIPIENT_EMAIL,
  appointmentDate: 'October 28, 2025',
  appointmentTime: '3:00 PM',
  service: 'General Check-up',
  bookingId: 'WDC-84315', // Placeholder Booking ID
  clientId: 'CID-2025-789', // Placeholder Client ID
};

/**
 * Main function to run the email sending test.
 */
const runTest = async () => {
  console.log(`Attempting to send a test appointment reminder to: ${TEST_RECIPIENT_EMAIL}...`);

  if (!process.env.RESEND_API_KEY) {
    console.error('FATAL: RESEND_API_KEY is not set in your .env file. Aborting.');
    return;
  }

  if (TEST_RECIPIENT_EMAIL === 'test@example.com') {
    console.warn('WARNING: Please update the TEST_RECIPIENT_EMAIL in this script to a real email address.');
    return;
  }

  try {
    // Since the domain is verified, we can now use the actual sendAppointmentReminder function
    // which correctly sends from 'management@wafadentalclinic.com'.
    const success = await sendAppointmentReminder(sampleClient);

    if (success) {
      console.log('Test Status: SUCCESS');
    } else {
      console.log('Test Status: FAILURE. Check the logs above for details from the email service.');
    }
  } catch (error) {
    console.error('An unexpected error occurred during the test:', error.message);
    console.log('Test Status: FAILURE');
  }
};

// --- Execute Test ---
runTest();
