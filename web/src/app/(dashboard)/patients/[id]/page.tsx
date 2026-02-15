"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/utils";
import { Patient } from "@/lib/types";
import { PatientInfoCard } from "@/components/patient-info-card";
import { ClinicalTab } from "@/components/clinical-tab";
import { ImagesTab } from "@/components/images-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";
import { toast } from "sonner";

export default function PatientDetailsPage() {
  const params = useParams();
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
      <PatientInfoCard patient={patient} onUpdate={fetchPatient} />

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
  );
}
