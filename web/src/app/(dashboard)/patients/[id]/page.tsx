"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_URL } from "@/lib/utils";
import { Patient } from "@/lib/types";
import { PatientInfoCard } from "@/components/features/patients/patient-info-card";
import { PatientSummaryCard } from "@/components/features/patients/patient-summary-card";
import { ClinicalTab } from "@/components/features/clinical/clinical-tab";
import { ImagesTab } from "@/components/features/clinical/images-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NotesPanel } from "@/components/features/dashboard/notes-panel";

export default function PatientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPatient = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/patients/${id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch patient");
      const data = await response.json();
      setPatient(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPatient();
    }
  }, [id, fetchPatient]);

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  if (!patient) {
    return <div className="text-center py-10">Patient not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back to Dashboard */}
      <Button
        variant="ghost"
        onClick={() => router.push("/")}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          <PatientInfoCard patient={patient} onUpdate={fetchPatient} />

          {/* Clinical Summary — editable, always visible at the top */}
          <PatientSummaryCard patient={patient} onUpdate={fetchPatient} />

          <Tabs defaultValue="clinical" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clinical">Clinical History</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="xrays">X-Rays</TabsTrigger>
            </TabsList>
            <TabsContent value="clinical">
              <ClinicalTab
                patientId={patient.id}
                records={patient.clinicalRecords || []}
                onUpdate={fetchPatient}
              />
            </TabsContent>
            <TabsContent value="photos">
              <ImagesTab
                patientId={patient.id}
                images={patient.patientImages || []}
                type="PHOTO"
                onUpdate={fetchPatient}
              />
            </TabsContent>
            <TabsContent value="xrays">
              <ImagesTab
                patientId={patient.id}
                images={patient.patientImages || []}
                type="XRAY"
                onUpdate={fetchPatient}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Notes Panel - Side Column */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 bg-white rounded-xl shadow-sm border overflow-hidden h-[calc(100vh-120px)]">
            <NotesPanel patientId={patient.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
