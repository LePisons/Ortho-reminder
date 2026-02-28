"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/lib/utils";
import { toast } from "sonner";
import { SettingsApi, MessageTemplate } from "@/lib/api/settings.api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();

  // ----- ACCOUNT SETTINGS STATE -----
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ----- CLINICAL SETTINGS STATE -----
  // const [settings, setSettings] = useState<Setting[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [labTurnaroundDays, setLabTurnaroundDays] = useState("");
  const [urgencyThresholdDays, setUrgencyThresholdDays] = useState("");
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [wearDaysPerAligner, setWearDaysPerAligner] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsData, templatesData] = await Promise.all([
          SettingsApi.getSettings(),
          SettingsApi.getTemplates(),
        ]);

        // setSettings(settingsData);
        setTemplates(templatesData);

        settingsData.forEach((s) => {
          if (s.key === "lab_turnaround_days") setLabTurnaroundDays(s.value);
          if (s.key === "urgency_threshold_days") setUrgencyThresholdDays(s.value);
          if (s.key === "technician_email") setTechnicianEmail(s.value);
          if (s.key === "wear_days_per_aligner") setWearDaysPerAligner(s.value);
        });
      } catch {
        toast.error("Error al cargar la configuración clínica");
      } finally {
        setLoadingConfig(false);
      }
    }

    loadData();
  }, []);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Profile updated successfully");
        await refreshUser();
      }
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveClinicalSettings = async () => {
    try {
      await SettingsApi.updateSettings([
        { key: "lab_turnaround_days", value: labTurnaroundDays },
        { key: "urgency_threshold_days", value: urgencyThresholdDays },
        { key: "technician_email", value: technicianEmail },
        { key: "wear_days_per_aligner", value: wearDaysPerAligner },
      ]);
      toast.success("Configuración clínica guardada");
    } catch {
      toast.error("Error al guardar configuración clínica");
    }
  };

  const handleSaveTemplate = async (id: string, newContent: string) => {
    try {
      await SettingsApi.updateTemplate(id, newContent);
      toast.success("Plantilla actualizada exitosamente");
    } catch {
      toast.error("Error al actualizar la plantilla");
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || "?";

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuración Global</h1>
        <p className="mt-1 text-sm text-gray-500">
          Administra tu perfil, preferencias clínicas y plantillas de mensajes automatizados.
        </p>
      </div>

      <Tabs defaultValue="clinical" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="clinical">Preferencias Clínicas</TabsTrigger>
          <TabsTrigger value="templates">Plantillas de Mensajes</TabsTrigger>
          <TabsTrigger value="account">Mi Cuenta</TabsTrigger>
        </TabsList>

        {/* CLINICAL SETTINGS TAB */}
        <TabsContent value="clinical" className="space-y-6">
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Parámetros del Tratamiento</h2>
            
            {loadingConfig ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-100 rounded-lg"></div>
                <div className="h-10 bg-gray-100 rounded-lg"></div>
                <div className="h-10 bg-gray-100 rounded-lg"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="wearDays" className="text-gray-700 font-medium">
                    Días de uso por alineador (Por Defecto)
                  </Label>
                  <Input
                    id="wearDays"
                    type="number"
                    value={wearDaysPerAligner}
                    onChange={(e) => setWearDaysPerAligner(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">Este valor se usará para calcular la fecha del siguiente alineador.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="labDays" className="text-gray-700 font-medium">
                    Días estimados de entrega de Lab.
                  </Label>
                  <Input
                    id="labDays"
                    type="number"
                    value={labTurnaroundDays}
                    onChange={(e) => setLabTurnaroundDays(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgencyDays" className="text-gray-700 font-medium">
                    Alerta de &quot;Pedido Urgente&quot; (Días antes de quedarse sin stock)
                  </Label>
                  <Input
                    id="urgencyDays"
                    type="number"
                    value={urgencyThresholdDays}
                    onChange={(e) => setUrgencyThresholdDays(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="techEmail" className="text-gray-700 font-medium">
                    Mail del Laboratorio (Para pedidos directos)
                  </Label>
                  <Input
                    id="techEmail"
                    type="email"
                    value={technicianEmail}
                    onChange={(e) => setTechnicianEmail(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <hr className="my-6 border-gray-100" />
                
                <div className="flex justify-start">
                  <button
                    onClick={handleSaveClinicalSettings}
                    className="inline-flex items-center justify-center rounded-lg bg-[#254F22] px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1d3f1a] focus:outline-none focus:ring-2 focus:ring-[#254F22]/20 focus:ring-offset-2"
                  >
                    Guardar Preferencias
                  </button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Plantillas Autodespachables</h2>
            <p className="text-sm text-gray-500 mt-1">
              Las variables entre doble llave {'{{}}'} como {'{{patient_name}}'} serán reemplazadas dinámicamente por el despachador.
            </p>
          </div>

          {loadingConfig ? (
             <div className="animate-pulse flex gap-4">
               <div className="h-32 w-full bg-gray-100 rounded-lg"></div>
               <div className="h-32 w-full bg-gray-100 rounded-lg"></div>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 flex flex-col h-full hover:border-[#254F22]/30 transition-colors"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-900">{template.name}</h4>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                        Canal: <span className={template.channel === 'WHATSAPP' ? 'text-green-600' : 'text-blue-600'}>{template.channel}</span>
                      </p>
                    </div>
                  </div>

                  <Textarea
                    className="min-h-[140px] font-mono text-sm leading-relaxed mb-4 resize-none bg-slate-50 border-slate-200 focus:bg-white flex-1"
                    defaultValue={template.content}
                    onChange={(e) => {
                      const newTemplates = [...templates];
                      const index = newTemplates.findIndex((t) => t.id === template.id);
                      newTemplates[index].content = e.target.value;
                      setTemplates(newTemplates);
                    }}
                  />
                  
                  <div className="mt-auto flex justify-end">
                    <button
                      onClick={() => handleSaveTemplate(template.id, template.content)}
                      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800"
                    >
                      Actualizar Plantilla
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ACCOUNT SETTINGS TAB */}
        <TabsContent value="account" className="max-w-2xl space-y-6">
          {/* Profile Card */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Detalles de Perfil</h2>
            </div>
            <div className="p-6">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#254F22] to-[#3a7a35] text-white text-xl font-bold shadow-md">
                  {initials}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">{user?.name || "User"}</p>
                  <p className="text-sm text-gray-500">Miembro desde {memberSince}</p>
                </div>
              </div>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <Label className="text-gray-700 mb-1.5 inline-block">Nombre a Mostrar</Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-gray-700 mb-1.5 inline-block">Correo Electrónico</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#254F22] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-[#1d3f1a] disabled:opacity-60"
                  >
                    {profileSaving ? "Guardando..." : "Guardar Perfil"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Password Card */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Seguridad</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label className="text-gray-700 mb-1.5 inline-block">Contraseña Actual</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-700 mb-1.5 inline-block">Nueva Contraseña</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 mb-1.5 inline-block">Confirmar Contraseña</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-60"
                  >
                    {passwordSaving ? "Actualizando..." : "Actualizar Contraseña"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-100 bg-white shadow-sm">
            <div className="border-b border-red-100 px-6 py-4">
              <h2 className="text-base font-semibold text-red-700">Zona de Riesgo</h2>
            </div>
            <div className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm font-medium text-gray-900">Cerrar Sesión</p>
                <p className="text-sm text-gray-500">Termina la sesión activa en este dispositivo.</p>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-all hover:bg-red-50"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
