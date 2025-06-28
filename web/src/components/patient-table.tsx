import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Importing the table parts from Shadcn

import { Patient } from "@/app/page";

interface PatientTableProps {
  patients: Patient[];
}

export function PatientTable({ patients }: PatientTableProps) {
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
