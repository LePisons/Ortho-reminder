"use client"; // This must be the very first line

import { useEffect, useState } from "react"; // Import React hooks
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

  // useEffect runs when the component mounts (loads)
  useEffect(() => {
    // Define an async function to fetch the data
    const fetchPatients = async () => {
      try {
        const response = await fetch("http://localhost:3001/patients");
        const data = await response.json();
        setPatients(data); // Update our state with the fetched data
      } catch (error) {
        console.error("Failed to fetch patients:", error);
      }
    };

    fetchPatients(); // Call the function
  }, []); // The empty array [] means this effect runs only once

  return (
    <main className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        {" "}
        {/* New container for layout */}
        <h1 className="text-3xl font-bold">Patient Dashboard</h1>
        <AddPatientDialog /> {/* <-- ADD THE COMPONENT HERE */}
      </div>
      <PatientTable patients={patients} />
    </main>
  );
}
