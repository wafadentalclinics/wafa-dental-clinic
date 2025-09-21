const nodemailer = require('nodemailer');
const getEmailHtml = require('../templates/emailTemplate');

/**
 * Configures and returns a Nodemailer transporter using Titan SMTP settings.
 * Credentials are pulled from environment variables.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true', // Use SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Sends a booking confirmation email.
 *
 * @param {object} bookingDetails - The details of the booking.
 * @param {Buffer} pdfBuffer - The generated PDF as a buffer.
 */
const sendConfirmationEmail = async (bookingDetails, pdfBuffer) => {
  const transporter = createTransporter();
  const { clientName, clientEmail, service } = bookingDetails;

  // Generate the professional HTML for the email body
  const emailHtml = getEmailHtml(bookingDetails);

  const mailOptions = {
    from: `"Wafa Dental Clinic" <${process.env.SMTP_USER}>`,
    to: clientEmail,
    subject: `Booking Confirmed: Your Appointment for ${service}`,
    html: emailHtml,
    attachments: [
      {
        filename: 'Wafa_Dental_Clinic_Booking_Confirmation.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    // Re-throw the error to be caught by the calling function in server.js
    throw new Error('Failed to send confirmation email.');
  }
};

module.exports = sendConfirmationEmail;
