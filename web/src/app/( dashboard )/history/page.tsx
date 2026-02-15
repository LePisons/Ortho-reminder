"use client";

import { useEffect, useState } from "react";

import { API_URL } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// 1. Define the type for our Message Log data
type MessageLog = {
  id: string;
  sentAt: string;
  messageContent: string;
  patient: {
    fullName: string;
  };
};

export default function HistoryPage() {
  // 2. Create state to hold the logs
  const [logs, setLogs] = useState<MessageLog[]>([]);

  // 3. Fetch the data when the page loads
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_URL}/message-log`);
        const data = await response.json();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch message logs:", error);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Message History</h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <Table>
          <TableCaption>A list of all sent reminders.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Patient Name</TableHead>
              <TableHead>Message Content</TableHead>
              <TableHead className="text-right">Date Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">
                  {log.patient.fullName}
                </TableCell>
                <TableCell>{log.messageContent}</TableCell>
                <TableCell className="text-right">
                  {new Date(log.sentAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
