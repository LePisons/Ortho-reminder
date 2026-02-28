const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateDb() {
    console.log("Locating WELCOME template...");

    const template = await prisma.messageTemplate.findFirst({
        where: { type: 'WELCOME', channel: 'WHATSAPP' }
    });

    if (!template) {
        console.log("WELCOME template not found in DB!");
        return;
    }

    // The content must be the JSON representation of what we just sent successfully to Meta
    const metaFormat = {
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
                            image: { link: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=600&auto=format&fit=crop' }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: '{{patient_name}}' }, // Inject patient name
                        { type: 'text', text: 'Dr. Piso' } // Or {{clinic_name}} if available
                    ]
                }
            ]
        }
    };

    await prisma.messageTemplate.update({
        where: { id: template.id },
        data: { content: JSON.stringify(metaFormat) }
    });

    console.log("Updated WELCOME template formatting in DB!");
    await prisma.$disconnect();
}

updateDb();
