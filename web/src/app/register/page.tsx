import { PatientRegistrationForm } from "@/app/register/patient-registration-form";

export default function RegisterPage() {
  return (
    <main className="container mx-auto flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center">Registro de Paciente</h1>
        <PatientRegistrationForm />
      </div>
    </main>
  );
}
