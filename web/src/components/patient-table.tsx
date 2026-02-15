
import Link from "next/link";
import { API_URL } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Importing the table parts from Shadcn

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Patient } from "@/app/( dashboard )/page";
import { Button } from "@/components/ui/button";
import { EditPatientDialog } from "./edit-patient-dialog";

interface PatientTableProps {
  patients: Patient[];
  onDataChange: () => void;
}

export function PatientTable({ patients, onDataChange }: PatientTableProps) {
  // Handle delete function

  const handleDelete = async (patientId: string) => {
    try {
      const response = await fetch(
        `${API_URL}/patients/${patientId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete patient");
      }

      toast.success("Patient deleted successfully!");
      onDataChange(); // Call the callback to refresh the table
    } catch (error) {
      toast.error("Failed to delete patient.");
      console.error("Delete error:", error);
    }
  };
  return (
    <Table>
      <TableCaption>Lista de los últimos pacientes</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Full Name</TableHead>
          <TableHead>RUT</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead className="text-right">Change Frequency</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow key={patient.id}>
            <TableCell className="font-medium">
              <Link href={`/patients/${patient.id}`} className="hover:underline text-blue-600">
                {patient.fullName}
              </Link>
            </TableCell>
            <TableCell>{patient.rut}</TableCell>
            <TableCell>{patient.phone}</TableCell>
            <TableCell>
              <Badge
                variant={
                  patient.status === "ACTIVE"
                    ? "default"
                    : patient.status === "PAUSED"
                    ? "secondary"
                    : "destructive"
                }
              >
                {patient.status}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(patient.treatmentStartDate).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {patient.changeFrequency} days
            </TableCell>
            <TableCell className="text-right">
              <EditPatientDialog
                patient={patient}
                onPatientUpdated={onDataChange}
              >
                {/* The Button is now a "child" of the dialog */}
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </EditPatientDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the patient &quot;{patient.fullName}&quot; and all of their
                      associated data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(patient.id)}>
                      Continue
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
