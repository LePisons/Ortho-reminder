"use client"; // This must be the very first line

import { useEffect, useState, useCallback } from "react"; // Import React hooks
import { PatientTable } from "@/components/patient-table";
import { AddPatientDialog } from "@/components/add-patient-dialog";

// We define a Type for our patient data to make our code safer
export type Patient = {
  id: string;
  rut: string;
  fullName: string;
  phone: string;
  email: string;
  treatmentStartDate: string;
  changeFrequency: number;
  status: "ACTIVE" | "PAUSED" | "FINISHED";
};

export default function HomePage() {
  // Create a state variable to hold our list of patients
  const [patients, setPatients] = useState<Patient[]>([]);

  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:3001/patients");
      const data = await response.json(); // <--- Corrected line
      setPatients(data);
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    }
  }, []);
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  return (
    <main className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        {" "}
        {/* New container for layout */}
        <h1 className="text-3xl font-bold">Patient Dashboard</h1>
        <AddPatientDialog onPatientAdded={fetchPatients} />{" "}
        {/* <-- ADD THE COMPONENT HERE */}
      </div>
      <PatientTable patients={patients} onDataChange={fetchPatients} />
    </main>
  );
}
