import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OrthoClient, OrthoApiError } from './client.js';

// Shared field shapes mirroring the API DTOs so the tool schemas stay in sync
// with api/src/patients/dto/create-patient.dto.ts. Validation is still enforced
// server-side; these just guide the agent and catch obvious mistakes early.
const patientCoreFields = {
  rut: z.string().describe('Chilean RUT, e.g. "12.345.678-9"'),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().email(),
  treatmentStartDate: z.string().describe('YYYY-MM-DD'),
  changeFrequency: z
    .number()
    .int()
    .describe('Days between aligner changes, e.g. 14'),
} as const;

const patientOptionalFields = {
  totalAligners: z.number().int().min(0).optional(),
  currentAligner: z.number().int().min(0).optional(),
  wearDaysPerAligner: z.number().int().min(1).optional(),
  batchStartDate: z.string().optional().describe('YYYY-MM-DD'),
  diagnosis: z.string().optional(),
  treatmentPlan: z.string().optional(),
  observations: z.string().optional(),
  clinic: z.string().max(120).optional(),
  doctor: z.string().max(120).optional(),
} as const;

function ok(data: unknown) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(data, null, 2) },
    ],
  };
}

function fail(err: unknown) {
  const message =
    err instanceof OrthoApiError
      ? `API error ${err.status}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}

/** Wrap a tool handler so thrown errors become MCP error results. */
function guard<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };
}

export function registerTools(server: McpServer, client: OrthoClient) {
  // ---- Patients ---------------------------------------------------------
  server.registerTool(
    'patient_search',
    {
      title: 'Search patients',
      description: 'Search internal patients by name, RUT, email or phone.',
      inputSchema: { q: z.string().describe('Search term') },
    },
    guard(({ q }) => client.get('/patients/search', { q })),
  );

  server.registerTool(
    'patient_list',
    {
      title: 'List patients',
      description: 'Paginated list of internal patients.',
      inputSchema: {
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    guard(({ page, limit }) => client.get('/patients', { page, limit })),
  );

  server.registerTool(
    'patient_get',
    {
      title: 'Get patient',
      description: 'Fetch a single internal patient by id.',
      inputSchema: { id: z.string() },
    },
    guard(({ id }) => client.get(`/patients/${id}`)),
  );

  server.registerTool(
    'patient_create',
    {
      title: 'Create patient',
      description:
        'Create an internal patient. rut, fullName, phone, email, ' +
        'treatmentStartDate and changeFrequency are required.',
      inputSchema: { ...patientCoreFields, ...patientOptionalFields },
    },
    guard((args) => client.post('/patients', args)),
  );

  server.registerTool(
    'patient_update',
    {
      title: 'Update patient',
      description: 'Update fields on an existing patient (partial).',
      inputSchema: {
        id: z.string(),
        rut: z.string().optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        treatmentStartDate: z.string().optional(),
        changeFrequency: z.number().int().optional(),
        ...patientOptionalFields,
      },
    },
    guard(({ id, ...body }) => client.patch(`/patients/${id}`, body)),
  );

  server.registerTool(
    'patient_adjust_aligner',
    {
      title: 'Adjust current aligner',
      description: 'Set the patient\'s current aligner number.',
      inputSchema: { id: z.string(), alignerNumber: z.number().int().min(0) },
    },
    guard(({ id, alignerNumber }) =>
      client.patch(`/patients/${id}/adjust-aligner`, { alignerNumber }),
    ),
  );

  server.registerTool(
    'patient_start_treatment',
    {
      title: 'Start treatment',
      description: 'Begin aligner treatment for a patient.',
      inputSchema: {
        id: z.string(),
        startingAligner: z.number().int().min(0),
        startDate: z.string().describe('YYYY-MM-DD'),
        wearDaysPerAligner: z.number().int().min(1).optional(),
        totalAligners: z.number().int().min(0).optional(),
      },
    },
    guard(({ id, ...body }) =>
      client.post(`/patients/${id}/start-treatment`, body),
    ),
  );

  server.registerTool(
    'patient_start_tracking',
    {
      title: 'Start tracking',
      description: 'Move a patient into active tracking.',
      inputSchema: { id: z.string() },
    },
    guard(({ id }) => client.post(`/patients/${id}/start-tracking`)),
  );

  server.registerTool(
    'patient_set_last_appointment',
    {
      title: 'Set last appointment',
      description: "Record the patient's most recent appointment date.",
      inputSchema: { id: z.string(), date: z.string().describe('YYYY-MM-DD') },
    },
    guard(({ id, date }) =>
      client.patch(`/patients/${id}/last-appointment`, { date }),
    ),
  );

  // ---- Dentalink --------------------------------------------------------
  server.registerTool(
    'dentalink_list_clinics',
    {
      title: 'List Dentalink clinics',
      description: 'Clinics available as Controles tabs (keys + names).',
      inputSchema: {},
    },
    guard(() => client.get('/dentalink/clinics')),
  );

  server.registerTool(
    'dentalink_controles',
    {
      title: 'Dentalink controles',
      description: 'Paginated, searchable patient control list for a clinic.',
      inputSchema: {
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        filter: z.enum(['proximos7', 'sinProximo']).optional(),
        clinic: z.string().optional(),
        refresh: z.boolean().optional(),
      },
    },
    guard(({ refresh, ...rest }) =>
      client.get('/dentalink/controles', {
        ...rest,
        refresh: refresh ? 'true' : undefined,
      }),
    ),
  );

  server.registerTool(
    'dentalink_patient_summary',
    {
      title: 'Dentalink patient summary',
      description: 'Live control summary for one Dentalink patient.',
      inputSchema: { id: z.number().int().positive(), clinic: z.string().optional() },
    },
    guard(({ id, clinic }) =>
      client.get(`/dentalink/patients/${id}/summary`, { clinic }),
    ),
  );

  server.registerTool(
    'dentalink_patient_history',
    {
      title: 'Dentalink patient history',
      description: 'Full appointment history for one Dentalink patient.',
      inputSchema: { id: z.number().int().positive(), clinic: z.string().optional() },
    },
    guard(({ id, clinic }) =>
      client.get(`/dentalink/patients/${id}/history`, { clinic }),
    ),
  );

  server.registerTool(
    'dentalink_patient_profile',
    {
      title: 'Dentalink patient profile',
      description:
        'Demographics (rut/name/email/phone) for a Dentalink patient, ' +
        'useful for creating an internal patient.',
      inputSchema: { id: z.number().int().positive(), clinic: z.string().optional() },
    },
    guard(({ id, clinic }) =>
      client.get(`/dentalink/patients/${id}/profile`, { clinic }),
    ),
  );

  server.registerTool(
    'dentalink_link_patient',
    {
      title: 'Link patient to Dentalink',
      description:
        'Link an internal patient to a Dentalink id (adds to the roster).',
      inputSchema: {
        patientId: z.string(),
        dentalinkId: z.number().int().positive(),
        clinic: z.string().optional(),
      },
    },
    guard((args) => client.post('/dentalink/link', args)),
  );

  // ---- Composite --------------------------------------------------------
  server.registerTool(
    'patient_create_from_dentalink',
    {
      title: 'Create patient from Dentalink',
      description:
        'Fetch demographics from Dentalink and create an internal patient, ' +
        'then optionally link them. Treatment fields must still be supplied.',
      inputSchema: {
        dentalinkId: z.number().int().positive(),
        treatmentStartDate: z.string().describe('YYYY-MM-DD'),
        changeFrequency: z.number().int(),
        // Optional overrides for anything Dentalink is missing or wrong on.
        rut: z.string().optional(),
        fullName: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        link: z
          .boolean()
          .optional()
          .describe('Link the new patient to the Dentalink id (default true)'),
        ...patientOptionalFields,
      },
    },
    guard(async (args) => {
      const {
        dentalinkId,
        clinic,
        link = true,
        rut,
        fullName,
        phone,
        email,
        ...treatment
      } = args;

      const profile = await client.get<{
        nombre: string;
        rut: string | null;
        email: string | null;
        telefono: string | null;
      }>(`/dentalink/patients/${dentalinkId}/profile`, { clinic });

      const payload = {
        rut: rut ?? profile.rut ?? '',
        fullName: fullName ?? profile.nombre,
        phone: phone ?? profile.telefono ?? '',
        email: email ?? profile.email ?? '',
        clinic,
        ...treatment,
      };

      const created = await client.post<{ id: string }>('/patients', payload);

      let linkResult: unknown = undefined;
      if (link && created?.id) {
        linkResult = await client.post('/dentalink/link', {
          patientId: created.id,
          dentalinkId,
          clinic,
        });
      }

      return { patient: created, linked: link, linkResult };
    }),
  );
}
