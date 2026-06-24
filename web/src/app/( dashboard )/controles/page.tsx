"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CalendarX,
  ChevronDown,
  Inbox,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/features/patients/pagination-controls";
import { ManageDentalinkPatientsDialog } from "@/components/features/controles/manage-dentalink-patients-dialog";
import {
  DentalinkApi,
  type ControlSummary,
  type ControlesFilter,
  type ControlesResponse,
  type DentalinkCita,
  type PatientHistory,
} from "@/lib/api/dentalink.api";

const PAGE_SIZE = 20;

function fmtCita(c: DentalinkCita | null | undefined): string {
  if (!c?.fecha) return "Sin cita registrada";
  const hora = c.hora_inicio ? ` ${c.hora_inicio.slice(0, 5)}` : "";
  const estado = c.estado_cita ? ` (${c.estado_cita})` : "";
  return `${c.fecha}${hora}${estado}`;
}

function diasBadge(dias: number | null) {
  if (dias === null)
    return { label: "Sin próximo", color: "bg-gray-100 text-gray-500 border-gray-200" };
  if (dias <= 7)
    return {
      label: `${dias} día${dias === 1 ? "" : "s"}`,
      color: "bg-amber-100 text-amber-700 border-amber-200",
    };
  return {
    label: `${dias} días`,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function StatCard({
  icon: Icon,
  value,
  label,
  tone,
  active,
  onClick,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left bg-white rounded-xl border p-4 flex items-center gap-3 transition-all duration-200 hover:border-[#6469FC]/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6469FC]/30 ${
        active
          ? "border-[#6469FC] ring-2 ring-[#6469FC]/20 shadow-sm"
          : "border-gray-100"
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </button>
  );
}

function HistoryDetail({ patientId }: { patientId: number }) {
  const [history, setHistory] = useState<PatientHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    DentalinkApi.getPatientHistory(patientId)
      .then((h) => active && setHistory(h))
      .catch(() => active && setError("No se pudo cargar el historial"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [patientId]);

  if (loading)
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-[#6469FC]" />
        Cargando historial…
      </div>
    );
  if (error) return <p className="text-xs text-rose-500 py-2">{error}</p>;
  if (!history?.citas.length)
    return <p className="text-xs text-gray-400 py-2">Sin citas registradas.</p>;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
        Historial de citas ({history.citas.length})
      </p>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50 bg-white">
        {history.citas.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="text-gray-700 font-medium">
              {c.fecha}
              {c.hora_inicio ? ` · ${c.hora_inicio.slice(0, 5)}` : ""}
            </span>
            <Badge variant="outline" className="text-[10px] text-gray-500">
              {c.estado_cita ?? "—"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlRow({ p }: { p: ControlSummary }) {
  const [expanded, setExpanded] = useState(false);
  const alerta = p.diasRestantes !== null && p.diasRestantes <= 7;
  const badge = diasBadge(p.diasRestantes);

  return (
    <div className={alerta ? "bg-amber-50/40" : ""}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            alerta ? "bg-amber-100" : "bg-violet-50"
          }`}
        >
          <Stethoscope
            className={`w-4 h-4 ${alerta ? "text-amber-600" : "text-violet-500"}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-gray-900 truncate">{p.nombre}</p>
          <p className="text-xs text-gray-500 truncate">
            Próximo: {fmtCita(p.proximoControl)}
          </p>
        </div>

        <Badge variant="outline" className={`text-[10px] shrink-0 ${badge.color}`}>
          {badge.label}
        </Badge>

        <ChevronDown
          className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-0 ml-[52px] animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Último control
              </p>
              <p className="text-sm text-gray-700">{fmtCita(p.ultimoControl)}</p>
              <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
                {p.resumenUltimo || (
                  <span className="text-gray-400 italic">Sin registro de evolución</span>
                )}
              </p>
            </div>

            {/* When the most recent control was left blank, surface the last visit
                that does have evolution notes so it isn't lost behind empty ones. */}
            {p.ultimoControlConRegistro &&
              p.ultimoControlConRegistro.id !== p.ultimoControl?.id && (
                <div>
                  <p className="text-[11px] font-bold text-violet-400 uppercase tracking-wider mb-1">
                    Último control con registro
                  </p>
                  <p className="text-sm text-gray-700">
                    {fmtCita(p.ultimoControlConRegistro)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-3 border border-violet-100">
                    {p.resumenUltimoConRegistro}
                  </p>
                </div>
              )}

            <HistoryDetail patientId={p.id} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ControlesPage() {
  const [data, setData] = useState<ControlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ControlesFilter | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, filter]);

  // Clicking a stat card toggles its filter; clicking the active one clears it.
  const toggleFilter = (next: ControlesFilter | null) =>
    setFilter((cur) => (cur === next ? null : next));

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        const res = await DentalinkApi.getControles({
          search: debounced,
          page,
          pageSize: PAGE_SIZE,
          refresh,
          filter: filter ?? undefined,
        });
        setData(res);
      } catch (e) {
        console.error("Failed to fetch controles:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debounced, page, filter],
  );

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight text-[#1B1B1B]">
            Controles
          </h1>
          <p className="text-[#7c7c84] mt-1.5">
            Próximos controles e historial de pacientes (Dentalink)
            {data?.fechaReporte ? ` · ${data.fechaReporte}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ManageDentalinkPatientsDialog onChanged={() => load(true)} />
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg gap-2"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={Users}
          value={data?.stats.total ?? 0}
          label="Pacientes"
          tone="bg-violet-50 text-violet-500"
          active={false}
          onClick={() => setFilter(null)}
        />
        <StatCard
          icon={CalendarClock}
          value={data?.stats.proximos7 ?? 0}
          label="Próximos 7 días"
          tone="bg-amber-50 text-amber-500"
          active={filter === "proximos7"}
          onClick={() => toggleFilter("proximos7")}
        />
        <StatCard
          icon={CalendarX}
          value={data?.stats.sinProximo ?? 0}
          label="Sin próximo control"
          tone="bg-gray-100 text-gray-400"
          active={filter === "sinProximo"}
          onClick={() => toggleFilter("sinProximo")}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar paciente…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#6469FC]/30 focus:border-[#6469FC]"
        />
      </div>

      {/* API errors */}
      {data && data.errores.length > 0 && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm mb-1.5">
            <AlertTriangle className="w-4 h-4" />
            Errores de API ({data.errores.length})
          </div>
          <ul className="text-xs text-rose-600 space-y-0.5 list-disc list-inside">
            {data.errores.map((e) => (
              <li key={e.id}>
                {e.nombre} (id {e.id}): {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#6469FC]" />
        </div>
      ) : !data || data.pacientes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No hay controles para mostrar</p>
          <p className="text-sm text-gray-400 mt-1">
            {debounced
              ? "Prueba con otro término de búsqueda"
              : filter
                ? "Ningún paciente coincide con este filtro"
                : "Revisa la configuración de Dentalink (DENTALINK_TOKEN / DENTALINK_PATIENT_IDS)"}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Activity className="w-3.5 h-3.5" />
            Ordenados por urgencia · filas resaltadas = control dentro de 7 días
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
            {data.pacientes.map((p) => (
              <ControlRow key={p.id} p={p} />
            ))}
          </div>
          {totalPages > 1 && (
            <PaginationControls
              currentPage={data.page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
