"use client";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {" "}
      {/* Reduce gap for a tighter look */}
      <Button
        size="sm" // <-- ADD THIS
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        Previous
      </Button>
      <span className="text-sm text-gray-600">
        {" "}
        {/* Make text smaller and lighter */}
        Page {currentPage} of {totalPages}
      </span>
      <Button
        size="sm" // <-- ADD THIS
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next
      </Button>
    </div>
  );
}
