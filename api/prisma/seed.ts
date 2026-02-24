import { PrismaClient, MessageChannel, MessageTemplateType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Seed Settings
  const settings = [
    { key: 'lab_turnaround_days', value: '7' },
    { key: 'urgency_threshold_days', value: '14' },
    { key: 'technician_email', value: '' },
    { key: 'orthodontist_whatsapp', value: '' },
    { key: 'wear_days_per_aligner', value: '14' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  // 2. Seed Default Templates (Mustache format)
  const templates = [
    {
      name: 'Recordatorio Cambio de Alineador',
      type: MessageTemplateType.ALIGNER_CHANGE_REMINDER,
      channel: MessageChannel.WHATSAPP,
      content: '¡Hola {{patient_name}}! 🦷 Hoy te toca cambiar al alineador #{{aligner_number}}. Recuerda usarlo mínimo 22 horas al día para que tu tratamiento avance perfecto. ¿Pudiste cambiarlo sin problemas? (Responde SÍ o NO)',
    },
    {
      name: 'Confirmación Appt. 48h',
      type: MessageTemplateType.APPOINTMENT_REMINDER_48H,
      channel: MessageChannel.WHATSAPP,
      content: 'Hola {{patient_name}}, te recuerdo tu cita de ortodoncia el {{appointment_date}} a las {{appointment_time}}. Por favor confirma tu asistencia.',
    },
    {
      name: 'Alineadores Listos',
      type: MessageTemplateType.BATCH_PICKUP_READY,
      channel: MessageChannel.WHATSAPP,
      content: '¡Excelente noticia {{patient_name}}! 🎉 Tu nueva etapa de alineadores ya llegó a la clínica y está lista para ser entregada.',
    },
    {
      name: 'Pedido a Laboratorio',
      type: MessageTemplateType.LAB_ORDER_REQUEST,
      channel: MessageChannel.EMAIL,
      content: '<h1>Solicitud de Alineadores - Alnix</h1><p>Estimado laboratorio,</p><p>Favor fabricar la siguiente etapa para el paciente <strong>{{patient_rut}}</strong>.</p><p>Cantidad solicitada: {{aligner_count}} pares.</p><p>Notas clínicas: {{clinical_notes}}</p>',
    },
    {
      name: 'Alerta: Pedido Urgente',
      type: MessageTemplateType.ORTHODONTIST_ALERT_BATCH_URGENT,
      channel: MessageChannel.WHATSAPP,
      content: '⚠️ Alerta Clínica: El paciente {{patient_name}} necesita que se le pidan nuevos alineadores (quedan {{days_remaining}} días).',
    },
    {
      name: 'Bienvenida al Tratamiento',
      type: MessageTemplateType.WELCOME,
      channel: MessageChannel.WHATSAPP,
      content: '¡Bienvenido/a {{patient_name}} a tu tratamiento con alineadores invisibles! Activa tus recordatorios aquí: {{onboarding_url}}',
    },
  ];

  for (const template of templates) {
    await prisma.messageTemplate.upsert({
      where: { name: template.name },
      update: {},
      // Ensure the correct Type enum is populated
      create: template,
    });
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
