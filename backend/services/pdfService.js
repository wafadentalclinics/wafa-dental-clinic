const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a premium, branded e-receipt for a booking confirmation.
 *
 * @param {object} bookingDetails - The details of the booking.
 * @returns {Promise<Buffer>} A promise that resolves with the PDF buffer.
 */
const generateConfirmationPdf = (bookingDetails) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on('error', (err) => {
        reject(err);
    });

    // --- Register Fonts ---
    // Note: For custom fonts, ensure the .ttf files are available.
    // For simplicity, we'll use standard fonts.
    const regularFont = 'Helvetica';
    const boldFont = 'Helvetica-Bold';
    const serifFont = 'Times-Roman'; // A standard serif font

    // --- Colors ---
    const primaryColor = '#010245';
    const textColor = '#334155';
    const lightTextColor = '#64748b';
    const borderColor = '#e2e8f0';

    // --- Header ---
    const logoPath = path.join(__dirname, '../../images/logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 60 });
    }
    doc.font(serifFont).fontSize(24).fillColor(primaryColor).text('WAFA Dental Clinic', { align: 'right' });
    doc.moveDown(2);
    doc.strokeColor(borderColor).lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(2);

    // --- Title ---
    doc.font(boldFont).fontSize(20).fillColor(textColor).text('Appointment E-Receipt', { align: 'center' });
    doc.moveDown(1);

    // --- Greeting ---
    doc.font(regularFont).fontSize(12).text(`Dear ${bookingDetails.clientName},`, { align: 'left' });
    doc.moveDown(0.5);
    doc.text('Thank you for booking with us. Here are the details of your upcoming appointment:', { align: 'left' });
    doc.moveDown(2);

    // --- Details Section ---
    const drawRow = (label, value) => {
        const y = doc.y;
        doc.font(boldFont).fillColor(lightTextColor).text(label, 50, y);
        doc.font(regularFont).fillColor(textColor).text(value, 200, y);
        doc.moveDown(1.5);
    };

    drawRow('Booking ID:', bookingDetails.bookingId || 'N/A');
    drawRow('Client ID:', bookingDetails.clientId || 'N/A');
    drawRow('Service:', bookingDetails.service);
    drawRow('Date:', bookingDetails.date);
    drawRow('Time:', bookingDetails.time);

    // --- Notes Section ---
    if (bookingDetails.additionalInfo && bookingDetails.additionalInfo.trim() !== '') {
        doc.moveDown(1);
        doc.font(boldFont).fillColor(lightTextColor).text('Your Notes / Previous Issues:');
        doc.moveDown(0.5);
        doc.font(regularFont).fillColor(textColor).text(bookingDetails.additionalInfo, {
            width: 500,
            align: 'left'
        });
        doc.moveDown(2);
    }

    // --- Important Notices ---
    doc.rect(50, doc.y, 500, 60).fillAndStroke('#f0f9ff', borderColor);
    doc.fillColor('#0369a1').font(boldFont).text('Important Information', 70, doc.y + 10 - 60);
    doc.fillColor('#075985').font(regularFont).text('• Please arrive 10 minutes early for your appointment.', 70, doc.y + 5);
    doc.text('• If you need to reschedule, please contact us at least 24 hours in advance.', 70, doc.y + 5);
    
    // --- Footer ---
    const footerY = 750;
    doc.strokeColor(borderColor).lineWidth(1).moveTo(50, footerY).lineTo(550, footerY).stroke();
    doc.fontSize(9).fillColor(lightTextColor).text('Office #7, 3rd Floor, The Ark Building, I-8 Markaz, Islamabad', 50, footerY + 15, { align: 'center' });
    doc.text('+92 51 8448877 | management@wafadentalclinic.com', 50, footerY + 30, { align: 'center' });
    doc.fillColor(primaryColor).text('www.wafadentalclinic.com', 50, footerY + 45, {
        align: 'center',
        link: 'https://www.wafadentalclinic.com',
        underline: true
    });

    // Finalize the PDF and end the stream
    doc.end();
  });
};

module.exports = generateConfirmationPdf;
