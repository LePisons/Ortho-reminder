
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

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

import { Patient } from "@/lib/types";
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
      <TableCaption>Latest Patients</TableCaption>
      <TableHeader className="bg-gray-50/50">
        <TableRow className="hover:bg-transparent border-gray-100">
          <TableHead className="text-xs uppercase tracking-wider text-gray-800 font-bold">Full Name</TableHead>
          <TableHead className="text-xs uppercase tracking-wider text-gray-800 font-bold">RUT</TableHead>
          <TableHead className="text-xs uppercase tracking-wider text-gray-800 font-bold">Phone</TableHead>
          <TableHead className="text-xs uppercase tracking-wider text-gray-800 font-bold">Status</TableHead>
          <TableHead className="text-xs uppercase tracking-wider text-gray-800 font-bold">Start Date</TableHead>
          <TableHead className="text-right text-xs uppercase tracking-wider text-gray-800 font-bold">Urgency Status</TableHead>
          <TableHead className="text-right text-xs uppercase tracking-wider text-gray-800 font-bold">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow key={patient.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
            <TableCell className="font-medium">
              <Link href={`/patients/${patient.id}`} className="hover:text-[#254F22] hover:underline hover:underline-offset-4 text-gray-900 transition-all font-bold group flex items-center gap-1">
                {patient.fullName} <span className="text-transparent group-hover:text-[#254F22] transition-colors">→</span>
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
              {patient.urgencyStatus ? (
                <Badge
                  variant={
                    patient.urgencyStatus === "ON_TRACK"
                      ? "outline"
                      : patient.urgencyStatus === "OVERDUE"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {patient.urgencyStatus.replace(/_/g, " ")}
                </Badge>
              ) : (
                <span className="text-gray-400 text-sm">N/A</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <EditPatientDialog
                    patient={patient}
                    onPatientUpdated={onDataChange}
                  >
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                      Edit details
                    </DropdownMenuItem>
                  </EditPatientDialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 focus:text-red-600 cursor-pointer"
                      >
                        Delete patient
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete
                          the patient &quot;{patient.fullName}&quot; and all of their
                          associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(patient.id)} className="bg-red-600 hover:bg-red-700">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
