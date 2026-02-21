import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean; // defaults to true
  };
}

export function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  const isPositive = trend?.isPositive !== false;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md flex items-center justify-between">
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</h3>
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-black text-gray-900 tracking-tight">{value}</p>
        </div>
        
        {trend && (
          <div className={`flex items-center text-xs mt-1.5 font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1 shrink-0" /> : <TrendingDown className="w-3 h-3 mr-1 shrink-0" />}
            <span>{trend.value}</span>
            <span className="text-gray-400 ml-1.5">{trend.label}</span>
          </div>
        )}

        {description && (
          <p className="text-xs text-gray-400 mt-1 font-medium">{description}</p>
        )}
      </div>
      {icon && (
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
      )}
    </div>
  );
}
