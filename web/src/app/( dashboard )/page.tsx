"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react"; // 1. We already have this from your code
import { PatientTable } from "@/components/patient-table";
import { AddPatientDialog } from "@/components/add-patient-dialog";
import { StatCard } from "@/components/stat-card";
import { UpcomingChangesList } from "@/components/upcoming-changes-list";
import { PaginationControls } from "@/components/pagination-controls";

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
  const { data: session } = useSession(); // 2. We already have this

  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [stats, setStats] = useState({ active: 0, paused: 0, finished: 0 });

  const [upcoming, setUpcoming] = useState([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);

  // --- START OF MODIFICATIONS ---

  const fetchStats = useCallback(async () => {
    if (!session?.accessToken) return; // Don't run without a token
    try {
      const response = await fetch("http://localhost:3001/patients/stats", {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, [session]); // Add session as a dependency

  const fetchPatients = useCallback(
    async (page: number) => {
      if (!session?.accessToken) return;
      try {
        const response = await fetch(
          `http://localhost:3001/patients?page=${page}&limit=10`,
          {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch patients");
        const result = await response.json();
        setPatients(result.data);
        setTotalPages(result.totalPages);
        setCurrentPage(result.page);
      } catch (error) {
        console.error("Failed to fetch patients:", error);
      }
    },
    [session]
  ); // Add session as a dependency

  const fetchUpcoming = useCallback(
    async (page: number) => {
      if (!session?.accessToken) return;
      try {
        const response = await fetch(
          `http://localhost:3001/patients/upcoming?page=${page}&limit=5`,
          {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          }
        );
        if (!response.ok) throw new Error("Failed to fetch upcoming");
        const result = await response.json();
        setUpcoming(result.data);
        setUpcomingTotalPages(result.totalPages);
        setUpcomingPage(result.page);
      } catch (error) {
        console.error("Failed to fetch upcoming changes:", error);
      }
    },
    [session]
  ); // Add session as a dependency

  // This useEffect will run whenever the session becomes available
  useEffect(() => {
    if (session) {
      fetchStats();
      fetchPatients(1);
      fetchUpcoming(1);
    }
  }, [session, fetchStats, fetchPatients, fetchUpcoming]);

  // This useEffect handles pagination for the main table
  useEffect(() => {
    // We check for currentPage > 1 to avoid a double-fetch on initial load
    if (session && currentPage > 1) {
      fetchPatients(currentPage);
    }
  }, [session, currentPage, fetchPatients]);

  // Handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleUpcomingPageChange = (newPage: number) => {
    fetchUpcoming(newPage);
  };

  const handleDataChange = () => {
    fetchStats();
    fetchUpcoming(1);
    if (currentPage === 1) {
      fetchPatients(1);
    } else {
      setCurrentPage(1);
    }
  };

  // --- END OF MODIFICATIONS ---

  // We no longer need the frontend calculation for activePatients
  // const activePatients = patients.filter((p) => p.status === "ACTIVE").length;

  return (
    <div>
      {/* ... The rest of your JSX is exactly the same and perfectly correct ... */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Active Patients" value={stats.active} />
        <StatCard title="Paused Patients" value={stats.paused} />
        <StatCard title="Finished Patients" value={stats.finished} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Patient List</h2>
            <AddPatientDialog onPatientAdded={handleDataChange} />
          </div>
          <PatientTable patients={patients} onDataChange={handleDataChange} />
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Upcoming Changes</h2>
            <UpcomingChangesList
              patients={upcoming}
              currentPage={upcomingPage}
              totalPages={upcomingTotalPages}
              onPageChange={handleUpcomingPageChange}
            />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Activity Feed</h2>
            <p className="text-gray-500">Feature coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
