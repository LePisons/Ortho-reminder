const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./src/app.module');
const { NotificationDispatcherService } = require('./src/messaging/notification-dispatcher.service');

async function testDispatch() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const dispatcher = app.get(NotificationDispatcherService);
    const { PrismaService } = require('./src/prisma/prisma.service');
    const prisma = app.get(PrismaService);

    const patient = await prisma.patient.findFirst({ orderBy: { createdAt: 'desc' } });
    const welcomeTemplate = await prisma.messageTemplate.findFirst({
        where: { type: 'WELCOME', channel: 'WHATSAPP' }
    });

    console.log("Patient:", patient.id);
    console.log("Template:", welcomeTemplate.name);

    try {
        console.log("Dispatching...");
        await dispatcher.dispatch({
            patientId: patient.id,
            templateType: 'WELCOME',
            template: welcomeTemplate,
            channel: 'WHATSAPP',
            recipient: patient.phone,
            variables: {
                patient_name: patient.fullName.split(' ')[0],
                clinic_name: 'Ortho-Reminder Clinic'
            },
            triggeredBy: 'manual',
        });
        console.log("Dispatch completed successfully.");
    } catch (err) {
        console.error("CRASH OCCURRED:");
        console.error(err);
    }

    await app.close();
}

testDispatch();
