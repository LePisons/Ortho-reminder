require('dotenv').config();

const token = process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_ID;
const apiUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

const testPhone = '+56994598005'; // Change this if we want to send to a different test number

const payload = {
    messaging_product: 'whatsapp',
    to: testPhone.replace(/\D/g, ''),
    type: 'template',
    template: {
        name: 'hello_world', // Default template given by Meta on setup
        language: { code: 'en_US' }
    },
};

async function testSend() {
    console.log(`Sending to ${testPhone} via Phone ID: ${phoneId}`);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error during fetch:', error);
    }
}

testSend();
