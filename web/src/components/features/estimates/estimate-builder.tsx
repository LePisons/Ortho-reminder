"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  EstimatesApi,
  type CatalogItem,
  type EstimateData,
  type EstimateLineItem,
} from "@/lib/api/estimates.api";
import {
  buildEstimatePdf,
  computeTotals,
  estimateFileName,
  formatClp,
} from "./pdf/build-estimate-pdf";
import { LineItemsTable } from "./line-items-table";
import { PatientAutocomplete, type LinkedPatient } from "./patient-autocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Save } from "lucide-react";

const DURATION_OPTIONS = ["3-6 meses", "6-12 meses", "12-18 meses", "18-24 meses", "Más de 24 meses"];
const INSTALLMENT_OPTIONS = [3, 6, 12];

function formatRUT(raw: string): string {
  const rut = raw.replace(/[^\dkK]/g, "").toUpperCase().replace(/^0+/, "");
  if (rut.length === 0) return "";
  const cuerpo = rut.slice(0, -1).replace(/\D/g, "");
  const dv = rut.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
  return cuerpoFormateado + (cuerpo.length > 0 ? "-" : "") + dv;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function EstimateBuilder({
  initialData,
  onSaved,
}: {
  initialData: EstimateData | null;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [patientName, setPatientName] = useState("");
  const [linked, setLinked] = useState<LinkedPatient | null>(null);
  const [rut, setRut] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState("");
  const [alignerCount, setAlignerCount] = useState("");
  const [controlsCount, setControlsCount] = useState("");
  const [items, setItems] = useState<EstimateLineItem[]>([]);
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [cashDiscountPct, setCashDiscountPct] = useState("5");
  const [installments, setInstallments] = useState<number[]>([]);
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"pdf" | "save" | null>(null);

  useEffect(() => {
    EstimatesApi.catalogList()
      .then(setCatalog)
      .catch(() => toast.error("No se pudo cargar la lista de precios"));
  }, []);

  // Pre-fill when duplicating a saved estimate
  useEffect(() => {
    if (!initialData) return;
    setPatientName(initialData.patient.name);
    setLinked(null);
    setRut(initialData.patient.rut ?? "");
    setPhone(initialData.patient.phone ?? "");
    setEmail(initialData.patient.email ?? "");
    setDuration(initialData.treatment?.durationMonths ?? "");
    setAlignerCount(initialData.treatment?.alignerCount ?? "");
    setControlsCount(initialData.treatment?.controlsCount ?? "");
    setItems(initialData.items);
    setDiscountLabel(initialData.discount?.label ?? "");
    setDiscountAmount(initialData.discount?.amount ? String(initialData.discount.amount) : "");
    setCashDiscountPct(String(initialData.cashDiscountPct));
    setInstallments(initialData.installmentMonths);
    setValidityDays(String(initialData.validityDays));
    setNotes(initialData.notes ?? "");
  }, [initialData]);

  const buildData = (): EstimateData => ({
    version: 1,
    date: todayIso(),
    patient: {
      name: patientName.trim(),
      rut: rut.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    },
    treatment:
      duration || alignerCount || controlsCount
        ? {
            durationMonths: duration || undefined,
            alignerCount: alignerCount.trim() || undefined,
            controlsCount: controlsCount.trim() || undefined,
          }
        : undefined,
    items,
    discount:
      Number(discountAmount) > 0
        ? { label: discountLabel.trim() || "Descuento", amount: Number(discountAmount) }
        : undefined,
    cashDiscountPct: Math.min(100, Math.max(0, Number(cashDiscountPct) || 0)),
    installmentMonths: [...installments].sort((a, b) => a - b),
    validityDays: Math.max(1, Number(validityDays) || 30),
    notes: notes.trim() || undefined,
  });

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        discount: Number(discountAmount) > 0 ? { label: discountLabel, amount: Number(discountAmount) } : undefined,
        cashDiscountPct: Math.min(100, Math.max(0, Number(cashDiscountPct) || 0)),
        installmentMonths: installments,
      } as EstimateData),
    [items, discountAmount, discountLabel, cashDiscountPct, installments],
  );

  const validate = (): boolean => {
    if (!patientName.trim()) {
      toast.error("Ingrese el nombre del paciente");
      return false;
    }
    if (items.length === 0) {
      toast.error("Agregue al menos una prestación");
      return false;
    }
    return true;
  };

  const downloadPdf = async () => {
    if (!validate()) return;
    setBusy("pdf");
    try {
      const data = buildData();
      const blob = await buildEstimatePdf(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = estimateFileName(data);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al generar el PDF");
    } finally {
      setBusy(null);
    }
  };

  const saveEstimate = async () => {
    if (!validate()) return;
    setBusy("save");
    try {
      const data = buildData();
      const blob = await buildEstimatePdf(data);
      await EstimatesApi.create({
        pdf: blob,
        fileName: estimateFileName(data),
        patientName: data.patient.name,
        patientId: linked?.id ?? null,
        totalClp: totals.hasConsultar && totals.total === 0 ? null : totals.total,
        data,
      });
      toast.success("Presupuesto guardado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar el presupuesto");
    } finally {
      setBusy(null);
    }
  };

  const toggleInstallment = (months: number) => {
    setInstallments((prev) =>
      prev.includes(months) ? prev.filter((m) => m !== months) : [...prev, months],
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del paciente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre *</Label>
              <PatientAutocomplete
                name={patientName}
                onNameChange={setPatientName}
                linked={linked}
                onLink={(p) => {
                  setLinked(p);
                  setPatientName(p.fullName);
                  if (p.rut) setRut(formatRUT(p.rut));
                  if (p.phone) setPhone(p.phone);
                  if (p.email) setEmail(p.email);
                }}
                onUnlink={() => setLinked(null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input
                value={rut}
                onChange={(e) => setRut(formatRUT(e.target.value))}
                placeholder="12.345.678-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 ..."
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="paciente@correo.cl"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tratamiento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Duración estimada</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>N° de alineadores</Label>
              <Input
                value={alignerCount}
                onChange={(e) => setAlignerCount(e.target.value)}
                placeholder="Ej: 18 pares"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Controles sugeridos</Label>
              <Input
                value={controlsCount}
                onChange={(e) => setControlsCount(e.target.value)}
                placeholder="Ej: 12"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prestaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <LineItemsTable items={items} onChange={setItems} catalog={catalog} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Descuento y pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Descuento (CLP)</Label>
                <Input
                  inputMode="numeric"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Input
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  placeholder="Ej: Convenio"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dcto. contado (%)</Label>
                <Input
                  inputMode="numeric"
                  value={cashDiscountPct}
                  onChange={(e) => setCashDiscountPct(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Validez (días)</Label>
                <Input
                  inputMode="numeric"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cuotas con la clínica</Label>
              <div className="flex gap-2">
                {INSTALLMENT_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleInstallment(m)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                      installments.includes(m)
                        ? "border-transparent bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white"
                        : "border-input text-muted-foreground hover:bg-gray-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notas adicionales</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aparecerán en las consideraciones del PDF"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {totals.discountAmount > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatClp(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Descuento</span>
                  <span>-{formatClp(totals.discountAmount)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="font-semibold">Total</span>
              <span className="bg-gradient-to-br from-[#A066F8] to-[#6469FC] bg-clip-text text-xl font-bold text-transparent">
                {formatClp(totals.total)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Contado (−{Number(cashDiscountPct) || 0}%)</span>
              <span className="font-medium text-foreground">{formatClp(totals.cashTotal)}</span>
            </div>
            {totals.installments.map((inst) => (
              <div key={inst.months} className="flex justify-between text-muted-foreground">
                <span>{inst.months} cuotas</span>
                <span>{formatClp(inst.amount)} c/u</span>
              </div>
            ))}
            {totals.hasConsultar && (
              <p className="pt-1 text-xs text-amber-600">
                * Prestaciones “Consultar” no incluidas en el total
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button onClick={saveEstimate} disabled={busy !== null}>
            <Save className="mr-1.5 h-4 w-4" />
            {busy === "save" ? "Guardando..." : "Guardar presupuesto"}
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={busy !== null}>
            <Download className="mr-1.5 h-4 w-4" />
            {busy === "pdf" ? "Generando..." : "Descargar PDF"}
          </Button>
        </div>
      </div>
    </div>
  );
}
