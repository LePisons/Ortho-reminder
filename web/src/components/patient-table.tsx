import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"; // Importing the table parts from Shadcn

export function PatientTable() {
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
        {/* We will map over our patient data here later */}
        <TableRow>
          <TableCell className="font-medium">Test Patient Uno</TableCell>
          <TableCell>11.111.111-1</TableCell>
          <TableCell>+56911111111</TableCell>
          <TableCell>ACTIVE</TableCell>
          <TableCell>2025-06-27</TableCell>
          <TableCell className="text-right">15 days</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
