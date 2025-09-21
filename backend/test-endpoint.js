const fetch = require('node-fetch');

const testEndpoint = async () => {
  const url = 'http://localhost:3000/send-confirmation';
  const bookingData = {
    "clientName": "Test Client",
    "clientEmail": "test@example.com",
    "service": "Annual Check-up",
    "date": "2025-09-23",
    "time": "11:00 AM",
    "additionalInfo": "This is a test booking from a script."
  };

  console.log('Sending test request to:', url);
  console.log('With data:', JSON.stringify(bookingData, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    });

    const responseData = await response.json();

    console.log('-------------------');
    console.log('Response Status:', response.status);
    console.log('Response Body:', responseData);
    console.log('-------------------');

    if (response.ok) {
      console.log('✅ Test successful!');
    } else {
      console.error('❌ Test failed.');
    }
  } catch (error) {
    console.error('❌ An error occurred during the test:', error);
  }
};

testEndpoint();
