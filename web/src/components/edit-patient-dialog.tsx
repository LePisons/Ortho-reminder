"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useForm } from "react-hook-form";
import type { Patient } from "@/app/page"; // Import our Patient type

// 1. Define the props this component will accept
interface EditPatientDialogProps {
  patient: Patient; // It receives the full patient object
  children: React.ReactNode;
  onPatientUpdated: () => void; // It receives the "trigger" button as a child
}

export function EditPatientDialog({
  patient,
  children,
  onPatientUpdated,
}: EditPatientDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 2. Set up the form with default values from the patient prop
  const form = useForm({
    defaultValues: {
      fullName: patient.fullName,
      rut: patient.rut,
      email: patient.email,
      phone: patient.phone,
      status: patient.status,
      // Format the incoming date string to be compatible with <input type="date">
      treatmentStartDate: new Date(patient.treatmentStartDate)
        .toISOString()
        .split("T")[0],
      changeFrequency: patient.changeFrequency,
    },
  });

  // 3. Define a placeholder submit handler
  async function onSubmit(values: any) {
    try {
      const response = await fetch(
        `http://localhost:3001/patients/${patient.id}`,
        {
          method: "PATCH", // Use the PATCH method for updates
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update patient");
      }

      alert("Patient updated successfully!");
      onPatientUpdated(); // Call the callback to refresh the table
      setIsOpen(false); // Close the dialog
    } catch (error) {
      console.error("Failed to update patient:", error);
      alert("Failed to update patient. Check the console for details.");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Patient: {patient.fullName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            {/* All the FormField components are the same as in the Add dialog */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="patient@email.com"
                      type="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+56912345678" type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="PAUSED">Paused</SelectItem>
                      <SelectItem value="FINISHED">Finished</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="treatmentStartDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="changeFrequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Change Frequency (days)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(event) => field.onChange(+event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
