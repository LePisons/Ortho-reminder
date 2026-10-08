"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { referralRequest } from "@/lib/api/referrals.api";

export function PatientReferrals({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    {
      id: string;
      revokedAt: string | null;
      referrer: { name: string; email: string };
    }[]
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let cancelled = false;
    referralRequest<typeof rows>(`/patient/${patientId}`)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, user?.role]);
  if (user?.role !== "ADMIN") return null;
  return (
    <section className="rounded-xl border p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">Colaboración con colegas</h2>
        <Link
          href={`/derivaciones?patientId=${patientId}`}
          className="text-sm underline underline-offset-4"
        >
          Compartir con colega
        </Link>
      </div>
      {error ? (
        <p className="text-sm text-red-700">
          No se pudieron cargar los casos compartidos.
        </p>
      ) : rows.length ? (
        rows.map((row) => (
          <Link
            key={row.id}
            href={`/derivaciones/${row.id}`}
            className="block text-sm underline underline-offset-4"
          >
            Ver registros y conversación con{" "}
            {row.referrer.name || row.referrer.email}
            {row.revokedAt ? " (acceso revocado)" : ""}
          </Link>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta ficha no tiene casos compartidos.
        </p>
      )}
    </section>
  );
}
