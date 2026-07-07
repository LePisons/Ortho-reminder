"use client";
import { toast } from "sonner";
import { CloudDownload, Loader2, Plus } from "lucide-react";
import { API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useForm } from "react-hook-form"; // For form state management
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"; // Shadcn's Form components

import { useEffect, useState } from "react";
import { formatRut } from "@/lib/format-rut";
import { PatientsApi } from "@/lib/api/patients.api";
import { DentalinkApi, type Clinic } from "@/lib/api/dentalink.api";
import { DentalinkStore } from "@/lib/dentalink-store";

// defines the props interface

interface AddPatientDialogProps {
  onPatientAdded: () => void;
}

export function AddPatientDialog({ onPatientAdded }: AddPatientDialogProps) {
  // 1. Define your form.

  const getTodayDateString = () => {
    const today = new Date();
    // Adjust for the timezone offset before converting to ISO string
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split("T")[0];
  };
  // Control the dialog is open or not

  const [isOpen, setIsOpen] = useState(false);

  // Previously-used clinic/doctor values, for autocomplete suggestions.
  const [suggestions, setSuggestions] = useState<{
    clinics: string[];
    doctors: string[];
  }>({ clinics: [], doctors: [] });

  // Import-from-Dentalink state: after a successful lookup the created patient
  // is auto-linked to this Dentalink id/clinic.
  const [dlClinics, setDlClinics] = useState<Clinic[]>([]);
  const [dlClinic, setDlClinic] = useState("");
  const [dlId, setDlId] = useState("");
  const [dlLoading, setDlLoading] = useState(false);
  const [imported, setImported] = useState<{ dentalinkId: number; clinic?: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Discard any pending import when the dialog closes without saving.
      setImported(null);
      setDlId("");
      return;
    }
    PatientsApi.getFieldSuggestions()
      .then(setSuggestions)
      .catch(() => {
        /* suggestions are best-effort; ignore failures */
      });
    DentalinkStore.getClinics()
      .then((list) => {
        setDlClinics(list);
        setDlClinic((cur) => cur || (list.find((c) => c.available) ?? list[0])?.key || "");
      })
      .catch(() => {
        /* import section simply won't offer a clinic selector */
      });
  }, [isOpen]);

  const form = useForm({
    // We can add validation rules here later with Zod
    defaultValues: {
      fullName: "",
      rut: "",
      email: "",
      phone: "",
      clinic: "",
      doctor: "",
      changeFrequency: 14, // Default to 14 as per old requirement
      totalAligners: 0,
      currentAligner: 1,
      wearDaysPerAligner: 14,
      treatmentStartDate: getTodayDateString(), // Defaults to today's date in YYYY-MM-DD format
    },
  });

  const handleImport = async () => {
    const parsedId = Number(dlId.trim());
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      toast.warning("ID inválido", {
        description: "Ingresa el ID numérico del paciente en Dentalink.",
      });
      return;
    }
    setDlLoading(true);
    try {
      const profile = await DentalinkApi.getPatientProfile(parsedId, dlClinic || undefined);
      // Prefill only what Dentalink knows; missing fields stay editable/blank.
      form.setValue("fullName", profile.nombre ?? "");
      form.setValue("rut", profile.rut ? formatRut(profile.rut) : "");
      form.setValue("email", profile.email ?? "");
      form.setValue("phone", profile.telefono ?? "");
      setImported({ dentalinkId: parsedId, clinic: dlClinic || undefined });
      toast.success(`Datos de ${profile.nombre} importados`, {
        description:
          "Completa los datos del tratamiento y guarda. Se vinculará a Controles automáticamente.",
      });
    } catch (e) {
      toast.error("No se pudo importar", {
        description: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setDlLoading(false);
    }
  };

  // 2. Define a submit handler.
  async function onSubmit(values: Record<string, unknown>) {
    // Sync wearDaysPerAligner with changeFrequency since they represent the same thing
    values.wearDaysPerAligner = values.changeFrequency;
    // Don't persist blank clinic/doctor (keeps autocomplete suggestions clean).
    if (typeof values.clinic === "string" && !values.clinic.trim()) delete values.clinic;
    if (typeof values.doctor === "string" && !values.doctor.trim()) delete values.doctor;
    try {
      // 2a. Pre-flight Duplication Check
      const checkRes = await fetch(`${API_URL}/patients/check-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rut: values.rut,
          email: values.email,
          phone: values.phone,
        }),
        credentials: "include",
      });

      if (checkRes.ok) {
        const { exists, conflicts } = await checkRes.json();
        if (exists && conflicts.length > 0) {
          const proceed = window.confirm(
            `A patient with this ${conflicts.join(" and ")} is already registered.\n\nDo you want to proceed and create a duplicate record anyway?`
          );
          if (!proceed) {
            return; // Abort creation
          }
        }
      }

      // 2b. Proceed with Creation
      const response = await fetch(`${API_URL}/patients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
        credentials: "include",
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Backend Error Response:", errText);
        throw new Error(`API returned ${response.status}: ${errText}`);
      }

      const created = await response.json().catch(() => null);

      // Imported from Dentalink → link the new patient (adds them to the
      // clinic's Controles roster server-side). Link failure is non-fatal.
      if (imported && created?.id) {
        try {
          await DentalinkApi.linkPatient({
            patientId: created.id,
            dentalinkId: imported.dentalinkId,
            clinic: imported.clinic,
          });
          DentalinkStore.invalidateClinic(imported.clinic);
        } catch (e) {
          toast.warning("Paciente creado, pero no se pudo vincular a Controles", {
            description: e instanceof Error ? e.message : "Vincúlalo desde su perfil.",
          });
        }
      }

      // This is where we will add the "refresh" logic later
      toast.success("Patient created successfully!");
      onPatientAdded();
      setIsOpen(false);
      form.reset();
      setImported(null);
      setDlId("");
    } catch (error) {
      toast.error("Uh oh! Something went wrong.", {
        description: "There was a problem with your request.",
      });
      console.error("Failed to create patient:", error);
    }
  }
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          onClick={() => setIsOpen(true)}
          className="gap-2 rounded-xl bg-gradient-to-br from-[#A066F8] to-[#6469FC] px-5 py-[13px] h-auto text-[13.5px] font-bold text-white shadow-[0_8px_22px_rgba(100,105,252,0.38)] hover:brightness-105 hover:shadow-[0_10px_26px_rgba(100,105,252,0.5)]"
        >
          <Plus className="w-4 h-4" strokeWidth={2.4} />
          Add New Patient
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
          <DialogDescription>
            Enter the new patient&apos;s details here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>

        {/* THIS IS THE NEW FORM */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, (errors) => {
              // Non-invasive notification when validation blocks submission.
              if (errors.totalAligners) {
                toast.warning("Total aligners required", {
                  description:
                    "Set a total aligner count of at least 1 before creating the patient.",
                });
              }
            })}
            className="space-y-4"
          >
            {/* Import from Dentalink: prefill name/RUT/email/phone by ID. */}
            <div
              className={`rounded-xl border p-3 space-y-2 ${
                imported ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-gray-50/60"
              }`}
            >
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <CloudDownload className="w-3.5 h-3.5" />
                Importar desde Dentalink (opcional)
              </p>
              <div className="flex gap-2">
                {dlClinics.length > 1 && (
                  <select
                    value={dlClinic}
                    onChange={(e) => setDlClinic(e.target.value)}
                    className="rounded-md border border-gray-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6469FC]/30 focus:border-[#6469FC]"
                  >
                    {dlClinics.map((c) => (
                      <option key={c.key} value={c.key} disabled={!c.available}>
                        {c.nombre}
                        {c.available ? "" : " (sin token)"}
                      </option>
                    ))}
                  </select>
                )}
                <Input
                  value={dlId}
                  onChange={(e) => setDlId(e.target.value)}
                  inputMode="numeric"
                  placeholder="ID de Dentalink (ej: 1416)"
                  className="bg-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleImport}
                  disabled={dlLoading || !dlId.trim()}
                  className="shrink-0"
                >
                  {dlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                </Button>
              </div>
              {imported && (
                <p className="text-xs text-emerald-700">
                  Se vinculará a Controles (ID {imported.dentalinkId}) al guardar.
                </p>
              )}
            </div>

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
                    <Input 
                      placeholder="11.111.111-1" 
                      {...field} 
                      onBlur={(e) => {
                        field.onBlur(); // keep react-hook-form's blur
                        field.onChange(formatRut(e.target.value));
                      }}
                    />
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
              name="clinic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Referring dental office"
                      list="clinic-suggestions"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="clinic-suggestions">
                    {suggestions.clinics.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="doctor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Doctor (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Referring colleague / dentist"
                      list="doctor-suggestions"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="doctor-suggestions">
                    {suggestions.doctors.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
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
                  <FormLabel>Change Frequency (Wear Days)</FormLabel>
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
            <FormField
              control={form.control}
              name="totalAligners"
              rules={{
                required: "Total aligners is required.",
                min: {
                  value: 1,
                  message: "Total aligners must be at least 1 to start treatment.",
                },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Aligners</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(event) => field.onChange(+event.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save patient</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
