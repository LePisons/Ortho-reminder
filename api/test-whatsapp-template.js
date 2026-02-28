require('dotenv').config();

const token = process.env.WHATSAPP_TOKEN;
const phoneId = process.env.WHATSAPP_PHONE_ID;
const apiUrl = `https://graph.facebook.com/v18.0/${phoneId}/messages`;

const testPhone = '+56994598005';

// Since the user added an image header, we have to supply a URL for it.
// We also need to supply the 2 text variables for the body.
const payload = {
    messaging_product: 'whatsapp',
    to: testPhone.replace(/\D/g, ''),
    type: 'template',
    template: {
        name: 'welcome_message',
        language: { code: 'es_CL' },
        components: [
            {
                type: 'header',
                parameters: [
                    {
                        type: 'image',
                        image: {
                            link: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&auto=format&fit=crop' // placeholder braces image
                        }
                    }
                ]
            },
            {
                type: 'body',
                parameters: [
                    { type: 'text', text: 'Luis' }, // Maps to {{1}}
                    { type: 'text', text: 'Dr. Smith' } // Maps to {{2}}
                ]
            }
        ]
    },
};

async function testTemplate() {
    console.log(`Sending 'welcome_message' to ${testPhone}...`);

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

testTemplate();
