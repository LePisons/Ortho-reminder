'use client';

import { useState, useEffect, use } from 'react';
// removed next/navigation
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { LogIn, ArrowRight, Clock, Box } from 'lucide-react';
import { cn, API_URL } from '@/lib/utils';
import { Patient } from '@/lib/types';

interface OnboardingResponse {
  status: 'valid' | 'already_used';
  patient: Patient;
}

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  // router is not used
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OnboardingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optingIn, setOptingIn] = useState(false);

  useEffect(() => {
    async function validate() {
      try {
        const response = await fetch(
          `${API_URL}/onboarding/${token}`
        );
        if (!response.ok) {
           throw { response: { status: response.status } };
        }
        const responseData = await response.json();
        setData(responseData);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error?.response?.status === 404) {
          setError('Enlace inválido o no encontrado.');
        } else if (error?.response?.status === 400) {
          setError('Este enlace ha expirado. Contacta a tu ortodoncista.');
        } else {
          setError('Ha ocurrido un error al conectar con el servidor.');
        }
      } finally {
        setLoading(false);
      }
    }
    validate();
  }, [token]);

  const handleOptIn = async () => {
    setOptingIn(true);
    try {
      const response = await fetch(
        `${API_URL}/onboarding/${token}/optin`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error("Failed to opt in");
      
      toast.success('¡Excelente! Has activado tus recordatorios.');
      setData((prev) => (prev ? { ...prev, status: 'already_used' } : null));
    } catch {
      toast.error('Ocurrió un error al activar los recordatorios.');
    } finally {
      setOptingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">
          Validando invitación...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl text-center border">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Lo sentimos
          </h1>
          <p className="text-slate-600 mb-8">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-8 sm:p-10 shadow-xl border border-slate-100 relative overflow-hidden">
        {/* Decorative Top Left Blob */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
        {/* Decorative Bottom Right Blob */}
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 text-center flex flex-col items-center">
          {/* Logo Circle */}
          <div className="w-20 h-20 bg-primary text-white rounded-2xl flex items-center justify-center text-3xl font-black mb-8 shadow-lg shadow-primary/30 rotate-3 transition-transform hover:rotate-0">
            A
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
            Bienvenido/a a Alnix
          </h1>
          <p className="text-slate-500 mb-8 text-lg">
            Hola <span className="font-semibold text-slate-800">{data?.patient.fullName.split(' ')[0]}</span>
          </p>

          <div className="w-full bg-slate-50 rounded-2xl p-6 mb-8 text-left border border-slate-100">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm">✓</span>
              Recordatorios Automáticos
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Para asegurar el éxito de tu tratamiento de ortodoncia, te enviaremos 
              notificaciones por WhatsApp cada vez que te toque cambiar de alineador
              (cada {data?.patient.wearDaysPerAligner || 14} días).
            </p>
            <div className="text-xs text-muted-foreground flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
              <LogIn className="w-4 h-4 text-primary" />
              Solo usaremos tu número para recordatorios clínicos.
            </div>
          </div>

          <div className="w-full bg-blue-50/50 rounded-2xl p-6 mb-8 text-left border border-blue-100/50">
            <h3 className="font-semibold text-slate-900 mb-4 text-center">Instrucciones de Uso</h3>
            
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">22 Horas al Día</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Para que el tratamiento funcione, debes usar tus alineadores 22 horas al día. Solo debes quitártelos para comer y lavarte los dientes.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <Box className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">Usa tu Estuche</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Si el alineador no está en tu boca, debe estar en su estuche. Nunca los envuelvas en servilletas ni los dejes sueltos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {data?.status === 'already_used' ? (
            <div className="w-full">
              <div className="bg-green-50 text-green-700 p-4 rounded-2xl border border-green-200 mb-6 font-medium">
                ¡Tus recordatorios ya están activados!
              </div>
              <p className="text-sm text-slate-500">
                Puedes cerrar esta página de forma segura.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <Button
                onClick={handleOptIn}
                disabled={optingIn}
                className={cn(
                  "w-full h-14 text-lg rounded-2xl gap-2 font-semibold shadow-xl shadow-primary/20",
                  optingIn && "opacity-70"
                )}
              >
                {optingIn ? 'Activando...' : 'Activar Notificaciones'}
                {!optingIn && <ArrowRight className="w-5 h-5" />}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Al activar, aceptas recibir mensajes automatizados vía WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
