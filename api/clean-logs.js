const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const patient = await prisma.patient.findFirst({
        orderBy: { createdAt: 'desc' }
    });
    console.log('--- LATEST PATIENT ---');
    console.log(`Name: ${patient.fullName}`);
    console.log(`Created: ${patient.createdAt.toISOString()}`);

    const logs = await prisma.messageLog.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        include: { template: true }
    });
    console.log('\n--- MESSAGE LOGS FOR PATIENT ---');
    if (logs.length === 0) console.log('None.');
    for (const log of logs) {
        console.log(`Channel: ${log.channel}`);
        console.log(`Type: ${log.template ? log.template.type : 'Unknown'}`);
        console.log(`Status: ${log.status}`);
        console.log(`Created: ${log.createdAt.toISOString()}`);
        console.log(`Trigger: ${log.triggeredBy}`);
        if (log.error) console.log(`Error: ${log.error}`);
        console.log('---------------------------');
    }
}

check().finally(() => prisma.$disconnect());
