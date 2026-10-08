"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReferralInput, treatmentFields } from "@/lib/api/referrals.api";
import { primaryAction, SectionHeading } from "./referral-ui";
import { Save } from "lucide-react";

export function ReferralForm({
  initial,
  onSave,
  busy,
}: {
  initial?: ReferralInput;
  onSave: (data: ReferralInput) => Promise<void>;
  busy: boolean;
}) {
  const [value, setValue] = useState<ReferralInput>(
    initial || { fullName: "", rut: "", phone: "", email: "", reason: "" },
  );
  return (
    <form
      className="space-y-7"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(value);
      }}
    >
      <SectionHeading
        title="Datos del paciente"
        description="Información de contacto compartida con el profesional receptor."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            {
              key: "fullName",
              label: "Nombre del paciente",
              type: "text",
              max: 160,
              min: 2,
            },
            { key: "rut", label: "RUT", type: "text", max: 15, min: 8 },
            {
              key: "email",
              label: "Correo del paciente",
              type: "email",
              max: 254,
              min: 3,
            },
            {
              key: "phone",
              label: "Teléfono del paciente",
              type: "tel",
              max: 30,
              min: 6,
            },
          ] as const
        ).map((field) => (
          <label key={field.key} className="space-y-2 text-sm font-medium">
            {field.label}
            <Input
              required
              type={field.type}
              maxLength={field.max}
              minLength={field.min}
              value={value[field.key]}
              onChange={(e) =>
                setValue({ ...value, [field.key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Motivo de consulta y antecedentes
        <Textarea
          required
          minLength={5}
          maxLength={5000}
          rows={4}
          placeholder="Motivo principal de consulta, antecedentes relevantes y expectativas del paciente."
          value={value.reason}
          onChange={(e) => setValue({ ...value, reason: e.target.value })}
        />
      </label>
      <div className="space-y-5 border-t pt-6">
        <SectionHeading
          title="Solicitud de tratamiento"
          description="Deja instrucciones concretas para la planificación. Los campos sin completar se mostrarán como «Sin indicación registrada»."
        />
        <div className="grid gap-5 sm:grid-cols-2">
          {treatmentFields.map((field) => (
            <label
              key={field.key}
              className={`block space-y-2 text-sm font-medium ${field.key === "goals" ? "sm:col-span-2" : ""}`}
            >
              {field.label}
              <Textarea
                rows={field.key === "goals" ? 3 : 2}
                maxLength={field.max}
                value={value.treatment?.[field.key] || ""}
                placeholder={field.hint}
                onChange={(e) =>
                  setValue({
                    ...value,
                    treatment: {
                      ...value.treatment,
                      [field.key]: e.target.value,
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Estos datos serán visibles para el colega y el profesional receptor. Los
        archivos se adjuntan después de guardar.
      </p>
      <Button className={primaryAction} disabled={busy} type="submit">
        <Save size={17} />
        {busy ? "Guardando…" : "Guardar borrador"}
      </Button>
    </form>
  );
}
