/**
 * ==============================================================================
 * WAFA DENTAL CLINIC - RESEND EMAIL AUTOMATION MODULE
 * ==============================================================================
 *
 * Description:
 * This module handles all email sending functionalities for Wafa Dental Clinic
 * using the Resend email service (resend.com). It is designed to be robust,
 * easy to use, and simple to extend.
 *
 * Setup Instructions:
 *
 * 1. Install Dependencies:
 *    Run the following command in your backend directory:
 *    npm install resend dotenv
 *
 * 2. Set Environment Variables:
 *    Create a .env file in your backend's root directory and add your
 *    Resend API key:
 *
 *    RESEND_API_KEY=your_resend_api_key_here
 *
 *    You can get your API key from your Resend dashboard.
 *
 * 3. Domain Verification (Important for Production):
 *    For emails to be sent from 'management@wafadentalclinic.com', you must
 *    verify the 'wafadentalclinic.com' domain in your Resend account.
 *    Before verification, Resend sends emails from a default 'onboarding@resend.dev'
 *    address, which is safe for testing.
 *
 * ==============================================================================
 */

// Import necessary packages
const { Resend } = require('resend');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Loads environment variables from .env file

// Initialize Resend with the API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Define the sender email address.
// NOTE: This must be a verified domain in your Resend account for production use.
const FROM_ADDRESS = 'management@wafadentalclinic.com';

/**
 * ==============================================================================
 * HTML EMAIL TEMPLATES
 * ==============================================================================
 *
 * Simple HTML templates for different email types. These can be expanded or
 * moved to separate .html files if they become more complex.
 *
 */

/**
 * Generates the HTML content for an appointment reminder email.
 * @param {object} client - The client's appointment details.
 * @param {string} client.name - The client's name.
 * @param {string} client.appointmentDate - The date of the appointment (e.g., "October 26, 2023").
 * @param {string} client.appointmentTime - The time of the appointment (e.g., "2:30 PM").
 * @returns {string} The formatted HTML email content.
 */
const getAppointmentReminderTemplate = ({ name, appointmentDate, appointmentTime, service, bookingId, clientId }) => {
  const year = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Your Appointment at WAFA Dental Clinic</title>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;600&display=swap" rel="stylesheet">
      <style>
        body { margin: 0; padding: 0; background-color: #f4f7fa; font-family: 'Inter', sans-serif; color: #334155; -webkit-font-smoothing: antialiased; }
        .email-wrapper { padding: 20px 0; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #e2e8f0; }
        
        .header { padding: 25px 30px; text-align: center; border-bottom: 1px solid #e2e8f0; background: linear-gradient(to right, #010245, #061a70); }
        .logo { max-width: 50px; }
        .clinic-name { font-family: 'DM Serif Display', serif; color: #FFFFFF !important; font-size: 24px; margin: 10px 0 0; letter-spacing: 0.5px; }
        
        .content { padding: 30px; }
        .greeting { font-size: 18px; font-weight: 600; color: #1e293b; }
        .message { font-size: 16px; line-height: 1.6; margin: 15px 0; }
        
        .receipt { background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
        .receipt-title { font-family: 'DM Serif Display', serif; color: #010245; margin: 0 0 15px; text-align: center; font-size: 22px; }
        .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 15px; }
        .receipt-row:last-child { border-bottom: none; }
        .receipt-label { font-weight: 600; color: #475569; }
        .receipt-value { color: #1e293b; }
        
        .notices { margin-top: 25px; padding: 15px; background-color: #f0f9ff; border-left: 4px solid #38bdf8; border-radius: 8px; }
        .notices h3 { margin: 0 0 10px; font-weight: 600; color: #0369a1; }
        .notices p { margin: 5px 0; font-size: 14px; color: #075985; }
        
        .footer { background-color: #0f172a; padding: 25px; text-align: center; color: #94a3b8; }
        .social-links { margin-bottom: 20px; }
        .social-links a { margin: 0 10px; display: inline-block; transition: transform 0.2s; }
        .social-links a:hover { transform: translateY(-2px); }
        .social-icon { width: 22px; height: 22px; }
        .footer-links { margin-bottom: 15px; }
        .footer-links a { color: #94a3b8; text-decoration: none; font-size: 13px; margin: 0 8px; }
        .footer-links a:hover { color: #ffffff; }
        .copyright { font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <div class="header">
            <img src="https://www.wafadentalclinic.com/images/logo.png" alt="WAFA Dental Clinic Logo" class="logo">
            <h1 class="clinic-name">WAFA Dental Clinic</h1>
          </div>
          <div class="content">
            <p class="greeting">Dear ${name},</p>
            <p class="message">Your appointment is confirmed. We are pleased to provide you with the details of your upcoming visit.</p>
            <div class="receipt">
              <h2 class="receipt-title">Booking E-Receipt</h2>
              <div class="receipt-row">
                <span class="receipt-label">Booking ID:</span>
                <span class="receipt-value">${bookingId}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Client ID:</span>
                <span class="receipt-value">${clientId}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Service:</span>
                <span class="receipt-value">${service}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Date:</span>
                <span class="receipt-value">${appointmentDate}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Time:</span>
                <span class="receipt-value">${appointmentTime}</span>
              </div>
            </div>
            <div class="notices">
              <h3>Important Notices</h3>
              <p>&bull; Please arrive 10 minutes early to complete any necessary paperwork.</p>
              <p>&bull; If you need to reschedule, please contact us at least 24 hours in advance.</p>
            </div>
          </div>
          <div class="footer">
            <div class="social-links">
              <a href="https://www.facebook.com/wafadentalclinics" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png" alt="Facebook" class="social-icon"></a>
              <a href="https://www.instagram.com/wafadentalclinic.pk/" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/instagram-new--v1.png" alt="Instagram" class="social-icon"></a>
              <a href="https://www.linkedin.com/company/wafa-dental-clinic/" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/linkedin.png" alt="LinkedIn" class="social-icon"></a>
              <a href="https://x.com/TeamWafaDental" target="_blank"><img src="https://img.icons8.com/ios-filled/50/ffffff/twitterx--v1.png" alt="Twitter" class="social-icon"></a>
            </div>
            <div class="footer-links">
              <a href="https://www.wafadentalclinic.com" target="_blank">Website</a> &bull;
              <a href="https://www.google.com/maps/place/WAFA+Dental+Clinic/@33.6673337,73.0747596,17z/data=!3m1!4b1!4m6!3m5!1s0x38df957cc7644563:0x27a7ae2e6cda42ef!8m2!3d33.6673337!4d73.0747596!16s%2Fg%2F11xd1rytr0" target="_blank">Location</a> &bull;
              <a href="mailto:management@wafadentalclinic.com">Contact Us</a>
            </div>
            <p class="copyright">&copy; ${year} WAFA Dental Clinic. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * ==============================================================================
 * CORE EMAIL SENDING FUNCTIONS
 * ==============================================================================
 */

/**
 * Sends an email using the Resend service.
 *
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} htmlContent - The HTML content of the email body.
 * @returns {Promise<boolean>} - A promise that resolves to true if the email is sent successfully, false otherwise.
 */
const sendEmail = async (to, subject, htmlContent, attachments = []) => {
  // Basic validation
  if (!to || !subject || !htmlContent) {
    console.error('sendEmail Error: Missing required parameters (to, subject, or htmlContent).');
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to], // Resend API expects an array of recipients
      subject: subject,
      html: htmlContent,
      attachments: attachments,
    });

    if (error) {
      console.error('Error sending email via Resend:', error);
      return false;
    }

    console.log(`Email sent successfully to ${to}. Message ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('An unexpected error occurred in sendEmail:', error);
    return false;
  }
};

/**
 * Generates and sends a pre-formatted appointment reminder email.
 *
 * @param {object} client - An object containing the client's details.
 * @param {string} client.name - The client's full name.
 * @param {string} client.email - The client's email address.
 * @param {string} client.appointmentDate - The date of the appointment.
 * @param {string} client.appointmentTime - The time of the appointment.
 * @returns {Promise<boolean>} - A promise that resolves to true if the email is sent successfully, false otherwise.
 */
const sendAppointmentReminder = async (client) => {
  // Validate client object
  if (!client || !client.name || !client.email || !client.appointmentDate || !client.appointmentTime) {
    console.error('sendAppointmentReminder Error: Invalid or incomplete client object provided.');
    return false;
  }

  const subject = `Your Appointment Confirmation with WAFA Dental Clinic`;
  const htmlContent = getAppointmentReminderTemplate(client);

  return await sendEmail(client.email, subject, htmlContent);
};

/**
 * ==============================================================================
 * TESTING BLOCK
 * ==============================================================================
 *
 * To run this test script directly, execute the following command in your terminal:
 * node backend/services/resendEmailService.js
 *
 * This block will only run when the file is executed directly, not when it's
 * imported as a module into another file (e.g., your main server file).
 *
 */
if (require.main === module) {
  console.log('Running email service test script...');

  const testRecipientEmail = 'hammaddsaeed@gmail.com'; // IMPORTANT: Change to a real email address for testing

  // --- Test Case 1: Sending a simple, direct email ---
  const testDirectEmail = async () => {
    console.log('\n--- Testing direct sendEmail() function ---');
    const subject = 'Test Email from Wafa Dental Clinic';
    const html = '<h1>Hello!</h1><p>This is a test email sent directly using the sendEmail function.</p>';
    const success = await sendEmail(testRecipientEmail, subject, html);
    console.log(`Direct email test status: ${success ? 'SUCCESS' : 'FAILURE'}`);
  };

  // --- Test Case 2: Sending an appointment reminder ---
  const testAppointmentReminder = async () => {
    console.log('\n--- Testing sendAppointmentReminder() function ---');
    const sampleClient = {
      name: 'John Doe',
      email: testRecipientEmail,
      appointmentDate: 'September 25, 2025',
      appointmentTime: '10:00 AM',
      service: 'General Check-up',
      bookingId: 'WDC-TEST-001',
      clientId: 'CID-TEST-002',
    };
    const success = await sendAppointmentReminder(sampleClient);
    console.log(`Appointment reminder test status: ${success ? 'SUCCESS' : 'FAILURE'}`);
  };

  // --- Run all tests ---
  const runTests = async () => {
    if (!process.env.RESEND_API_KEY) {
      console.error('\nFATAL: RESEND_API_KEY is not set in your .env file. Aborting tests.');
      return;
    }
    if (testRecipientEmail === 'test@example.com') {
        console.warn('\nWARNING: Test recipient email is set to "test@example.com". Please update it to a real email address to receive test emails.');
    }
    await testAppointmentReminder();
  };

  runTests();
}

// Export the functions to be used in other parts of the application
module.exports = {
  sendEmail,
  sendAppointmentReminder,
  getAppointmentReminderTemplate, // Exporting the template function
};
