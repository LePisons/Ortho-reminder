import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Always proxy via Next.js on the client (browser) to avoid Ngrok CORS issues.
// Use direct backend URL on the Next.js server for SSR.
export const API_URL = typeof window !== "undefined" 
  ? "/api" 
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");
