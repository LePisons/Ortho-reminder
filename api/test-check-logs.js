const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogs() {
    console.log("Checking latest patients...");
    const patients = await prisma.patient.findMany({
        orderBy: { createdAt: 'desc' },
        take: 1
    });
    console.log("Latest Patient:", patients[0]);

    console.log("\nChecking latest message logs...");
    const logs = await prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log("Latest Messages:", logs);

    console.log("\nChecking WELCOME template...");
    const template = await prisma.messageTemplate.findFirst({
        where: { type: 'WELCOME', channel: 'WHATSAPP' }
    });
    console.log("Template found:", template ? true : false, template?.type, template?.channel);

    await prisma.$disconnect();
}

checkLogs();
