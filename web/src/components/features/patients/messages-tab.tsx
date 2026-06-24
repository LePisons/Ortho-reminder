"use client";

import { useEffect, useState, useRef } from "react";
import { API_URL } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCheck, Clock } from "lucide-react";
import { toast } from "sonner";

interface MessageLog {
  id: string;
  direction: "INCOMING" | "OUTGOING";
  channel: "WHATSAPP" | "EMAIL";
  content: string;
  status: string;
  createdAt: string;
  triggeredBy: string;
}

interface MessagesTabProps {
  patientId: string;
  onUpdate: () => void;
}

export function MessagesTab({ patientId, onUpdate }: MessagesTabProps) {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [patientId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      // Fetch messages
      const res = await fetch(`${API_URL}/patients/${patientId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      setMessages(data);

      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);

      // Check if there are unread incoming messages and mark them read
      const hasUnread = data.some(
        (m: any) => m.direction === "INCOMING" && m.isRead === false
      );
      if (hasUnread) {
        await fetch(`${API_URL}/patients/${patientId}/messages/read`, {
          method: "PATCH",
          credentials: "include",
        });
        onUpdate(); // refresh the parent to clear the red dot
      }
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar los mensajes");
    } finally {
      setLoading(false);
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="w-3 h-3 text-gray-400" />;
      case "SENT":
        return <Check className="w-3 h-3 text-gray-400" />;
      case "DELIVERED":
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case "READ":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "FAILED":
        return <span className="text-[10px] text-red-500 font-bold">ERR</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando mensajes...</div>;
  }

  return (
    <Card className="w-full mt-6 bg-[#efeae2]">
      <CardHeader className="bg-white border-b py-4">
        <CardTitle className="text-lg flex items-center gap-2">
          Historial de Mensajes
          <Badge variant="outline" className="text-xs font-normal">
            WhatsApp & Email
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={scrollRef}
          className="h-[500px] overflow-y-auto p-4 space-y-4"
          style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}
        >
          {messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <div className="bg-[#fff5c4] text-xs px-3 py-1.5 rounded-lg text-gray-600">
                Aún no hay mensajes para este paciente.
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isOutgoing = msg.direction === "OUTGOING";
              return (
                <div
                  key={msg.id}
                  className={`flex w-full ${isOutgoing ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg p-3 shadow-sm relative ${
                      isOutgoing ? "bg-[#d9fdd3] rounded-tr-none" : "bg-white rounded-tl-none"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {msg.channel === "WHATSAPP" ? "WhatsApp" : "Email"}
                      </span>
                      {msg.triggeredBy === "cron" && (
                        <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 rounded-md">Automático</span>
                      )}
                    </div>
                    
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {msg.content}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOutgoing && msg.channel === "WHATSAPP" && renderStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
