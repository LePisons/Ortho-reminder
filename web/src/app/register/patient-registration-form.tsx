"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function PatientRegistrationForm() {
  const getTodayDateString = () => {
    const today = new Date();
    // Adjust for the timezone offset before converting to ISO string
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split("T")[0];
  };

  const [isSuccess, setIsSuccess] = useState(false);
  const form = useForm({
    defaultValues: {
      fullName: "",
      rut: "",
      email: "",
      phone: "",
      changeFrequency: 10, // Default value
      treatmentStartDate: getTodayDateString(), // Defaults to today's date in YYYY-MM-DD format
    },
  });

  async function onSubmit(values: any) {
    try {
      const response = await fetch("http://localhost:3001/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Registration failed");
      setIsSuccess(true); // Set success state
    } catch (error) {
      console.error(error);
      alert("Registration failed. Please try again.");
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">¡Registro Exitoso!</h2>
        <p>
          Gracias por registrarte. Recibirás un mensaje de bienvenida en
          WhatsApp en breve.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter patient's full name" {...field} />
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
                <Input placeholder="11111111-1" {...field} />
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

        <Button type="submit" className="w-full">
          Registrarme
        </Button>
      </form>
    </Form>
  );
}
