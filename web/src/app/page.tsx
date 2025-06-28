import { PatientTable } from "@/components/patient-table"; // Import our new component

export default function HomePage() {
  return (
    <main className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Administración Pacientes</h1>
      <PatientTable />
    </main>
  );
}
