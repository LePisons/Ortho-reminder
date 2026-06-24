import { redirect } from 'next/navigation';

// Public self-registration is disabled. Accounts are provisioned by an
// administrator (see api/prisma/seed.ts). Anyone hitting /register is sent to login.
export default function RegisterPage() {
  redirect('/login');
}
