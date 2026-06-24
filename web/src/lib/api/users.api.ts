import { API_URL } from '@/lib/utils';

export type Role = 'ADMIN' | 'STAFF';

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: Role;
}

// Surfaces the API's error message (e.g. duplicate email) when present.
async function parseError(res: Response, fallback: string): Promise<never> {
  let message = fallback;
  try {
    const body = await res.json();
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }
  } catch {
    // non-JSON response; keep fallback
  }
  throw new Error(message);
}

export const UsersApi = {
  list: async (): Promise<ManagedUser[]> => {
    const res = await fetch(`${API_URL}/users`, { credentials: 'include' });
    if (!res.ok) await parseError(res, 'Failed to fetch users');
    return res.json();
  },

  create: async (input: CreateUserInput): Promise<ManagedUser> => {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to create user');
    return res.json();
  },

  remove: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) await parseError(res, 'Failed to delete user');
  },
};
