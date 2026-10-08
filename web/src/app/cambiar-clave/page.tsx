"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ChangePasswordPage() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);
  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <section className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-semibold">Crea tu contraseña personal</h1>
        <p className="text-muted-foreground">
          Antes de acceder a los casos, reemplaza la contraseña inicial. Usa al
          menos 12 caracteres.
        </p>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (newPassword !== confirm) {
              setError("Las contraseñas nuevas no coinciden.");
              return;
            }
            setBusy(true);
            try {
              const res = await fetch(`${API_URL}/auth/password`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
              });
              if (!res.ok) {
                const data = await res.json();
                throw new Error(
                  Array.isArray(data.message)
                    ? data.message.join(" · ")
                    : data.message,
                );
              }
              await logout();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "No se pudo cambiar la contraseña.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block space-y-2 text-sm">
            Contraseña actual o inicial
            <Input
              required
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            Nueva contraseña
            <Input
              required
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={72}
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm">
            Repetir nueva contraseña
            <Input
              required
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={busy || !user}>
            {busy ? "Guardando…" : "Guardar y volver a iniciar sesión"}
          </Button>
        </form>
        <button className="text-sm underline" onClick={() => void logout()}>
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}
