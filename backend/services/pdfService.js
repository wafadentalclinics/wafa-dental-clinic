const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a branded booking confirmation PDF.
 *
 * @param {object} bookingDetails - The details of the booking.
 * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
 */
const generateConfirmationPdf = (bookingDetails) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', (err) => {
        reject(err);
    });

    // --- PDF Content ---

    // Header with Logo
    const logoPath = path.join(__dirname, '../../images/logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 150 });
    } else {
        console.warn('Warning: Logo not found at', logoPath);
        doc.fontSize(20).text('Wafa Dental Clinic', 50, 57);
    }
    
    doc
      .fontSize(10)
      .text('Booking Confirmation', 200, 65, { align: 'right' });

    doc.moveDown(3);

    // Title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('Your Booking is Confirmed!', { align: 'center' });

    doc.moveDown(2);

    // Welcoming Message
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Dear ${bookingDetails.clientName},`, { continued: true })
      .font('Helvetica')
      .text(' we are pleased to confirm your appointment with us. Please review the details below.');

    doc.moveDown(2);

    // Booking Details Section
    const detailsY = doc.y;
    doc.font('Helvetica-Bold').text('Service:', 50, detailsY);
    doc.font('Helvetica').text(bookingDetails.service, 150, detailsY);

    doc.font('Helvetica-Bold').text('Date:', 50, detailsY + 30);
    doc.font('Helvetica').text(bookingDetails.date, 150, detailsY + 30);

    doc.font('Helvetica-Bold').text('Time:', 50, detailsY + 60);
    doc.font('Helvetica').text(bookingDetails.time, 150, detailsY + 60);
    
    if (bookingDetails.additionalInfo) {
        doc.font('Helvetica-Bold').text('Additional Info:', 50, detailsY + 90);
        doc.font('Helvetica').text(bookingDetails.additionalInfo, 150, detailsY + 90, {
            width: 410
        });
    }

    doc.y = detailsY + 120; // Move cursor down
    doc.moveDown(2);

    // Clinic Information
    doc
      .font('Helvetica-Bold')
      .text('Clinic Information');
    doc
      .font('Helvetica')
      .text('Office #7, 3rd Floor, The Ark Building, Markaz, I-8 Markaz I 8 Markaz I-8, Islamabad, 44000, Pakistan')
      .text('Phone: +92 51 8448877')
      .text('Email: management@wafadentalclinic.com')
      .text('Website: ', { continued: true })
      .fillColor('blue')
      .text('www.wafadentalclinic.com', { link: 'https://www.wafadentalclinic.com', underline: true })
      .fillColor('black');

    doc.moveDown();

    // Google Maps Link
    doc
      .font('Helvetica')
      .text('Location: ', { continued: true })
      .fillColor('blue')
      .text('Click here for directions on Google Maps', { link: 'https://www.google.com/maps/place/WAFA+Dental+Clinic/@33.6673337,73.0747596,17z/data=!3m1!4b1!4m6!3m5!1s0x38df957cc7644563:0x27a7ae2e6cda42ef!8m2!3d33.6673337!4d73.0747596!16s%2Fg%2F11xd1rytr0?entry=tts&g_ep=EgoyMDI1MDgyNS4wIPu8ASoASAFQAw%3D%3D&skid=3e4f1248-9eac-454b-81b2-2d7b8c2abadb', underline: true })
      .fillColor('black');

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(8)
      .text(
        'Thank you for choosing Wafa Dental Clinic. We look forward to seeing you!',
        50, 750, { align: 'center', lineBreak: false }
      );

    // Finalize the PDF and end the stream
    doc.end();
  });
};

module.exports = generateConfirmationPdf;
