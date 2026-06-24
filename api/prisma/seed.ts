import { PrismaClient, MessageChannel, MessageTemplateType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedBootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log(
      'Skipping admin bootstrap (set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD to create the first user).',
    );
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists; leaving it unchanged.`);
    return;
  }
  await prisma.user.create({
    data: {
      email,
      name: process.env.BOOTSTRAP_ADMIN_NAME || 'Admin',
      password: await bcrypt.hash(password, 12),
      role: 'ADMIN',
    },
  });
  console.log(`Created bootstrap admin user: ${email}`);
}

async function main() {
  console.log('Start seeding...');

  await seedBootstrapAdmin();

  // 1. Seed Settings
  const settings = [
    { key: 'lab_turnaround_days', value: '7' },
    { key: 'urgency_threshold_days', value: '14' },
    { key: 'technician_email', value: '' },
    { key: 'orthodontist_whatsapp', value: '' },
    { key: 'wear_days_per_aligner', value: '14' },
    { key: 'orthodontist_email', value: '' },
    { key: 'batch_ending_threshold', value: '3' },
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
      content: '<h1>Solicitud de Alineadores - {{clinic_name}}</h1><p>Estimado laboratorio,</p><p>Favor fabricar la etapa <strong>#{{batch_number}}</strong>.</p><p><strong>Orden #:</strong> {{order_number}}</p><p><strong>Paciente:</strong> {{patient_name}}</p><p>Cantidad solicitada: <strong>{{aligner_count}}</strong> pares.</p><p>Notas clínicas: {{notes}}</p><br><p><a href="{{file_download_link}}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Descargar Archivos de Impresión (.zip)</a></p><p><small>Este enlace expirará en 7 días por motivos de seguridad.</small></p>',
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
    // --- EMAIL TEMPLATES ---
    {
      name: 'Recordatorio Cambio de Alineador (Email)',
      type: MessageTemplateType.ALIGNER_CHANGE_REMINDER,
      channel: MessageChannel.EMAIL,
      content: '<h2>¡Hola {{patient_name}}! 🦷</h2><p>Es hora de cambiar a tu alineador <strong>#{{aligner_number}}</strong>.</p><p>Recuerda usarlo al menos 22 horas al día para que tu tratamiento avance según lo planificado.</p><p>Si tienes alguna duda, no dudes en contactarnos.</p><br><p style="color:#888;font-size:12px;">— Tu equipo de ortodoncia</p>',
    },
    {
      name: 'Alerta: Batch por Terminar (Lab)',
      type: MessageTemplateType.BATCH_ENDING_LAB_ALERT,
      channel: MessageChannel.EMAIL,
      content: '<h2>⚠️ Alerta de Stock — Paciente por terminar alineadores</h2><p>El paciente <strong>{{patient_name}}</strong> se encuentra en el alineador <strong>#{{current_aligner}}</strong> de <strong>{{total_aligners}}</strong>.</p><p>Le quedan aproximadamente <strong>{{aligners_remaining}} alineadores</strong> (~{{days_remaining}} días).</p><p>Es necesario coordinar el siguiente batch de producción.</p><br><p style="color:#888;font-size:12px;">— Sistema Alnix</p>',
    },
    {
      name: 'Cita Necesaria: Fin de Tratamiento',
      type: MessageTemplateType.APPOINTMENT_NEEDED,
      channel: MessageChannel.EMAIL,
      content: '<h2>📅 Cita Requerida — Fin de Tratamiento</h2><p>El paciente <strong>{{patient_name}}</strong> está por finalizar su tratamiento con alineadores.</p><p>Alineador actual: <strong>#{{current_aligner}}</strong> de <strong>{{total_aligners}}</strong></p><p>Fecha estimada de fin: <strong>{{estimated_end_date}}</strong></p><p>Se recomienda agendar una cita final de evaluación.</p><br><p style="color:#888;font-size:12px;">— Sistema Alnix</p>',
    },
    {
      name: 'Bienvenida al Tratamiento (Email)',
      type: MessageTemplateType.WELCOME,
      channel: MessageChannel.EMAIL,
      content: '<h2>¡Bienvenido/a {{patient_name}}! 🎉</h2><p>Nos alegra que comiences tu tratamiento con alineadores invisibles en <strong>Alnix</strong>.</p><p>Desde ahora recibirás recordatorios por email cada vez que debas cambiar de alineador.</p><p>Si tienes alguna duda sobre tu tratamiento, no dudes en contactarnos.</p><br><p style="color:#888;font-size:12px;">— Tu equipo en Alnix</p>',
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
