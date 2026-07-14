"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";
import { EstimateBuilder } from "@/components/features/estimates/estimate-builder";
import { EstimateHistory } from "@/components/features/estimates/estimate-history";
import { CatalogManager } from "@/components/features/estimates/catalog-manager";
import type { EstimateData } from "@/lib/api/estimates.api";
import { FileText } from "lucide-react";

export default function PresupuestosPage() {
  const [activeTab, setActiveTab] = useState("nuevo");
  const [draftToEdit, setDraftToEdit] = useState<EstimateData | null>(null);
  // Bumped on save so the history list refetches when we switch to it.
  const [historyRefresh, setHistoryRefresh] = useState(0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-[30px] font-extrabold tracking-tight text-[#1B1B1B]">
          <FileText className="h-7 w-7 text-[#6469FC]" />
          Presupuestos
        </h1>
        <p className="mt-1.5 text-sm text-[#7c7c84]">
          Genera presupuestos de tratamiento en PDF, guárdalos por paciente y administra tu
          lista de precios.
        </p>
      </div>

      <Tabs defaultValue="nuevo" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex w-full overflow-x-auto sm:grid sm:grid-cols-3 [&>button]:shrink-0">
          <TabsTrigger value="nuevo">Nuevo</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="precios">Precios</TabsTrigger>
        </TabsList>

        <TabsContent value="nuevo">
          <EstimateBuilder
            initialData={draftToEdit}
            onSaved={() => {
              setDraftToEdit(null);
              setHistoryRefresh((n) => n + 1);
              setActiveTab("historial");
            }}
          />
        </TabsContent>

        <TabsContent value="historial">
          <EstimateHistory
            refreshKey={historyRefresh}
            onDuplicate={(data) => {
              setDraftToEdit(data);
              setActiveTab("nuevo");
            }}
          />
        </TabsContent>

        <TabsContent value="precios">
          <CatalogManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
