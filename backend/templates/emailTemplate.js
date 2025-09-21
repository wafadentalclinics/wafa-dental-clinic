/**
 * Generates a professional HTML email template for a booking confirmation.
 *
 * @param {object} bookingDetails - The details of the booking.
 * @returns {string} The generated HTML string.
 */
const getEmailHtml = (bookingDetails) => {
  const { clientName, service, date, time } = bookingDetails;

  // Wafa Dental Clinic brand color
  const primaryColor = '#007BFF'; // A professional blue

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .header {
          background-color: ${primaryColor};
          color: #ffffff;
          padding: 40px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
          color: #333333;
          line-height: 1.6;
        }
        .booking-details {
          background-color: #f9f9f9;
          border-left: 4px solid ${primaryColor};
          padding: 20px;
          margin: 20px 0;
        }
        .booking-details p {
          margin: 10px 0;
        }
        .policy, .location {
          margin-top: 20px;
        }
        .footer {
          background-color: #333333;
          color: #ffffff;
          text-align: center;
          padding: 20px;
          font-size: 12px;
        }
        .footer a {
          color: #ffffff;
          text-decoration: underline;
        }
        .social-links a {
            margin: 0 10px;
            display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Booking is Confirmed!</h1>
        </div>
        <div class="content">
          <h2>Dear ${clientName},</h2>
          <p>Thank you for choosing Wafa Dental Clinic. We are pleased to confirm your appointment with us. Please find the details of your booking below.</p>
          
          <div class="booking-details">
            <p><strong>Service:</strong> ${service}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Time:</strong> ${time}</p>
          </div>

          <div class="policy">
            <h3>Cancellation & Rescheduling Policy</h3>
            <p>If you need to cancel or reschedule your appointment, please contact us at least 24 hours in advance. You can reach us at <a href="tel:+92518448877">+92 51 8448877</a>.</p>
          </div>

          <div class="location">
            <h3>Our Location</h3>
            <p>Office #7, 3rd Floor, The Ark Building, Markaz, I-8 Markaz I 8 Markaz I-8, Islamabad, 44000, Pakistan</p>
            <p><a href="https://www.google.com/maps/place/WAFA+Dental+Clinic/@33.6673337,73.0747596,17z/data=!3m1!4b1!4m6!3m5!1s0x38df957cc7644563:0x27a7ae2e6cda42ef!8m2!3d33.6673337!4d73.0747596!16s%2Fg%2F11xd1rytr0?entry=tts" style="color: ${primaryColor};">Get Directions on Google Maps</a></p>
          </div>
        </div>
        <div class="footer">
          <div class="social-links">
            <a href="https://www.facebook.com/wafadentalclinics" target="_blank">Facebook</a> | 
            <a href="https://www.instagram.com/wafadentalclinic.pk/" target="_blank">Instagram</a> | 
            <a href="https://x.com/TeamWafaDental" target="_blank">Twitter</a>
          </div>
          <p>Wafa Dental Clinic | +92 51 8448877 | <a href="mailto:management@wafadentalclinic.com">management@wafadentalclinic.com</a></p>
          <p>&copy; ${new Date().getFullYear()} Wafa Dental Clinic. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = getEmailHtml;
