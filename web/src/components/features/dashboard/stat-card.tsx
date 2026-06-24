import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  variant?: "primary" | "danger" | "warning" | "success" | "default";
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
}

const variantStyles = {
  primary: {
    iconBg: "bg-gradient-to-br from-[#A066F8] to-[#6469FC] text-white",
    accent: "text-[#1F9254]",
  },
  danger: {
    iconBg: "bg-[#FBE9E9] text-[#D6443B]",
    accent: "text-[#D6443B]",
  },
  warning: {
    iconBg: "bg-[#FBF1DC] text-[#C2810A]",
    accent: "text-[#9c8a6e]",
  },
  success: {
    iconBg: "bg-[#E6F4EC] text-[#1F9254]",
    accent: "text-[#9d9da6]",
  },
  default: {
    iconBg: "bg-[#F3EAFE] text-[#8a44e8]",
    accent: "text-[#9d9da6]",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon,
  variant = "default",
  trend,
}: StatCardProps) {
  const style = variantStyles[variant];

  return (
    <div className="bg-white border border-[#EBE7DE] rounded-[18px] p-5 flex flex-col gap-4 shadow-[0_1px_2px_rgba(27,27,27,0.04)] transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#8a8a93]">
          {title}
        </span>
        {icon && (
          <div
            className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="text-[38px] font-extrabold leading-none tracking-tight text-[#1B1B1B]">
          {value}
        </span>
        {trend && (
          <span className={`text-xs font-semibold ${style.accent}`}>
            {trend.isPositive ? "+" : ""}
            {trend.value} {trend.label}
          </span>
        )}
        {!trend && description && (
          <span className={`text-xs font-semibold ${style.accent}`}>
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
