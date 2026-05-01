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
    bg: "bg-gradient-to-br from-emerald-50 to-green-50",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    text: "text-emerald-700",
    border: "border-emerald-100",
  },
  danger: {
    bg: "bg-gradient-to-br from-rose-50 to-red-50",
    iconBg: "bg-gradient-to-br from-rose-500 to-red-600",
    text: "text-rose-700",
    border: "border-rose-100",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-50 to-orange-50",
    iconBg: "bg-gradient-to-br from-amber-500 to-orange-500",
    text: "text-amber-700",
    border: "border-amber-100",
  },
  success: {
    bg: "bg-gradient-to-br from-sky-50 to-blue-50",
    iconBg: "bg-gradient-to-br from-sky-500 to-blue-600",
    text: "text-sky-700",
    border: "border-sky-100",
  },
  default: {
    bg: "bg-white",
    iconBg: "bg-gradient-to-br from-gray-400 to-gray-500",
    text: "text-gray-700",
    border: "border-gray-100",
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
    <div
      className={`${style.bg} p-5 rounded-2xl shadow-sm border ${style.border} transition-all hover:shadow-md flex items-center justify-between group`}
    >
      <div>
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
          {title}
        </h3>
        <p className={`text-3xl font-black ${style.text} tracking-tight`}>
          {value}
        </p>

        {trend && (
          <div className="flex items-center text-xs mt-1.5 font-medium text-gray-400">
            <span>
              {trend.isPositive ? "+" : ""}
              {trend.value}
            </span>
            <span className="ml-1.5">{trend.label}</span>
          </div>
        )}

        {description && (
          <p className="text-xs text-gray-400 mt-1 font-medium">
            {description}
          </p>
        )}
      </div>
      {icon && (
        <div
          className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center text-white shrink-0 shadow-sm group-hover:scale-105 transition-transform`}
        >
          {icon}
        </div>
      )}
    </div>
  );
}
