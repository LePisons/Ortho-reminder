interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
}

export function StatCard({ title, value, description }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</h3>
      <p className="text-4xl font-semibold mt-3 text-gray-900 tracking-tight">{value}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1 font-medium">{description}</p>
      )}
    </div>
  );
}
