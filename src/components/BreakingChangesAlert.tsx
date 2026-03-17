'use client';

interface BreakingChangeRisk {
  module_id: string;
  module_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  affected_dependents: string[];
}

interface BreakingChangesAlertProps {
  risks: BreakingChangeRisk[];
}

const RISK_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  critical: { border: 'border-red-400/40', bg: 'bg-red-500/10', text: 'text-red-200', badge: 'bg-red-500/20 text-red-300' },
  high: { border: 'border-orange-400/40', bg: 'bg-orange-500/10', text: 'text-orange-200', badge: 'bg-orange-500/20 text-orange-300' },
  medium: { border: 'border-amber-400/40', bg: 'bg-amber-500/10', text: 'text-amber-200', badge: 'bg-amber-500/20 text-amber-300' },
  low: { border: 'border-gray-400/30', bg: 'bg-gray-500/5', text: 'text-gray-300', badge: 'bg-gray-500/20 text-gray-400' },
};

export default function BreakingChangesAlert({ risks }: BreakingChangesAlertProps) {
  const significantRisks = risks.filter(r => r.risk_level !== 'low');
  if (significantRisks.length === 0) return null;

  const criticalCount = significantRisks.filter(r => r.risk_level === 'critical').length;
  const highCount = significantRisks.filter(r => r.risk_level === 'high').length;

  return (
    <div className="rounded-xl border border-red-400/25 bg-red-500/[0.06] p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-red-200">Breaking Change Risks</span>
        {criticalCount > 0 && (
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
            {criticalCount} Critical
          </span>
        )}
        {highCount > 0 && (
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold text-orange-300">
            {highCount} High
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {significantRisks.map((risk) => {
          const colors = RISK_COLORS[risk.risk_level] || RISK_COLORS.low;
          return (
            <div key={risk.module_id} className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${colors.badge}`}>
                  {risk.risk_level}
                </span>
                <span className={`text-xs font-semibold ${colors.text}`}>{risk.module_name}</span>
              </div>
              <div className="mt-1 text-xs text-gray-300">{risk.reason}</div>
              {risk.affected_dependents.length > 0 && (
                <div className="mt-1.5 text-[11px] text-gray-400">
                  Affects: {risk.affected_dependents.join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
