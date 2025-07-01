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

import { Patient } from "@/app/page";
import { Button } from "@/components/ui/button";
import { EditPatientDialog } from "./edit-patient-dialog";

interface PatientTableProps {
  patients: Patient[];
  onPatientUpdated: () => void;
}

export function PatientTable({
  patients,
  onPatientUpdated,
}: PatientTableProps) {
  // Handle delete function

  const handleDelete = async (patientId: string) => {
    alert(`Deleting patient with ID: ${patientId}. API call will go here.`);
  };
  return (
    <Table>
      <TableCaption>A list of your recent patients.</TableCaption>
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
            <TableCell className="font-medium">{patient.fullName}</TableCell>
            <TableCell>{patient.rut}</TableCell>
            <TableCell>{patient.phone}</TableCell>
            <TableCell>{patient.status}</TableCell>
            <TableCell>
              {new Date(patient.treatmentStartDate).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {patient.changeFrequency} days
            </TableCell>
            <TableCell className="text-right">
              <EditPatientDialog
                patient={patient}
                onPatientUpdated={onPatientUpdated}
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
                      the patient "{patient.fullName}" and all of their
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
