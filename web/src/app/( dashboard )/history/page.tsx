"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/utils";
import {
  Mail,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Eye,
  User,
  Inbox,
  Filter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MessageLog = {
  id: string;
  channel: "EMAIL" | "WHATSAPP";
  recipient: string;
  content: string;
  status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  error?: string;
  triggeredBy: string;
  createdAt: string;
  patient?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  template?: {
    name: string;
    type: string;
  };
};

const channelConfig = {
  EMAIL: {
    icon: Mail,
    label: "Email",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  WHATSAPP: {
    icon: MessageCircle,
    label: "WhatsApp",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
};

const statusConfig: Record<
  string,
  { icon: typeof CheckCircle2; label: string; color: string }
> = {
  PENDING: { icon: Clock, label: "Pending", color: "text-amber-500" },
  SENT: { icon: Send, label: "Sent", color: "text-blue-500" },
  DELIVERED: {
    icon: CheckCircle2,
    label: "Delivered",
    color: "text-emerald-500",
  },
  READ: { icon: Eye, label: "Read", color: "text-violet-500" },
  FAILED: { icon: XCircle, label: "Failed", color: "text-rose-500" },
};

function formatTemplateName(type?: string) {
  if (!type) return null;
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "—";
  }
}

function formatFullDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_URL}/message-log`);
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch message logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filtered = logs.filter((log) => {
    if (channelFilter !== "ALL" && log.channel !== channelFilter) return false;
    if (statusFilter !== "ALL" && log.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const emailCount = logs.filter((l) => l.channel === "EMAIL").length;
  const whatsappCount = logs.filter((l) => l.channel === "WHATSAPP").length;
  const failedCount = logs.filter((l) => l.status === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[30px] font-extrabold tracking-tight text-[#1B1B1B]">
          Message History
        </h1>
        <p className="text-[#7c7c84] mt-1.5">
          All notifications sent to your patients
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <Send className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900 tracking-tight">
              {logs.length}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Total Sent
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-blue-700 tracking-tight">
              {emailCount}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Emails
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-emerald-700 tracking-tight">
              {whatsappCount}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              WhatsApp
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-rose-700 tracking-tight">
              {failedCount}
            </p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Failed
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex gap-1.5">
          {["ALL", "EMAIL", "WHATSAPP"].map((ch) => (
            <Button
              key={ch}
              variant={channelFilter === ch ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 rounded-lg"
              onClick={() => setChannelFilter(ch)}
            >
              {ch === "ALL" ? "All Channels" : ch === "EMAIL" ? "Email" : "WhatsApp"}
            </Button>
          ))}
        </div>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <div className="flex gap-1.5">
          {["ALL", "SENT", "DELIVERED", "FAILED"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 rounded-lg"
              onClick={() => setStatusFilter(st)}
            >
              {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Message list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No messages found</p>
          <p className="text-sm text-gray-400 mt-1">
            {logs.length > 0
              ? "Try adjusting your filters"
              : "Messages will appear here when notifications are sent"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {filtered.map((log) => {
            const channel = channelConfig[log.channel];
            const status = statusConfig[log.status] || statusConfig.SENT;
            const StatusIcon = status.icon;
            const ChannelIcon = channel.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id} className="group">
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : log.id)
                  }
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/50 transition-colors"
                >
                  {/* Channel icon */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      log.channel === "EMAIL" ? "bg-blue-50" : "bg-emerald-50"
                    }`}
                  >
                    <ChannelIcon
                      className={`w-4 h-4 ${
                        log.channel === "EMAIL"
                          ? "text-blue-500"
                          : "text-emerald-500"
                      }`}
                    />
                  </div>

                  {/* Patient + template */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {log.patient ? (
                        <Link
                          href={`/patients/${log.patient.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-sm text-gray-900 hover:text-primary hover:underline truncate"
                        >
                          {log.patient.fullName}
                        </Link>
                      ) : (
                        <span className="font-semibold text-sm text-gray-400 truncate">
                          Unknown patient
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${channel.color}`}
                      >
                        {channel.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {log.template
                        ? formatTemplateName(log.template.type)
                        : "Custom message"}{" "}
                      → {log.recipient}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusIcon className={`w-4 h-4 ${status.color}`} />
                    <span
                      className={`text-xs font-medium ${status.color} hidden sm:inline`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-right shrink-0 w-20">
                    <p className="text-xs font-medium text-gray-500">
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 ml-[52px] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                      {/* Full date */}
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {formatFullDate(log.createdAt)}
                        <span className="text-gray-300">•</span>
                        <span className="capitalize">{log.triggeredBy}</span>
                      </div>

                      {/* Content */}
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-white rounded-lg p-3 border border-gray-100">
                        {log.content || (
                          <span className="text-gray-400 italic">
                            No content available
                          </span>
                        )}
                      </div>

                      {/* Error */}
                      {log.error && (
                        <div className="flex items-start gap-2 text-xs text-rose-600 bg-rose-50 rounded-lg p-3 border border-rose-100">
                          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{log.error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
