'use client';

export interface FlowScenario {
  id: string;
  name: string;
  trigger: string;
  steps: Array<{
    moduleId: string;
    label: string;
    duration: number;
  }>;
  involvedEdges: string[];
  stepEdges: string[][];
}

interface FlowControlBarProps {
  isAnimating: boolean;
  mode: 'off' | 'ambient' | 'scenario';
  scenarios: FlowScenario[];
  activeScenarioId: string | null;
  speed: number;
  currentStep?: { index: number; total: number; label: string };
  disabled?: boolean;
  onToggle: () => void;
  onSelectScenario: (id: string | null) => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [0.5, 1, 2];

export default function FlowControlBar({
  isAnimating,
  mode,
  scenarios,
  activeScenarioId,
  speed,
  currentStep,
  disabled = false,
  onToggle,
  onSelectScenario,
  onSpeedChange,
}: FlowControlBarProps) {
  const isScenarioMode = mode === 'scenario' && Boolean(activeScenarioId);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
        <button
          onClick={onToggle}
          disabled={disabled}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-semibold text-gray-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnimating && mode !== 'off' ? 'Pause' : 'Simulate'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-gray-400">Scenario</span>
          <select
            value={activeScenarioId || ''}
            disabled={disabled}
            onChange={(event) => onSelectScenario(event.target.value || null)}
            className="rounded-lg border border-white/15 bg-[#0b1120] px-2 py-1.5 text-xs text-gray-200"
          >
            <option value="">All Edges</option>
            {scenarios.map(scenario => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-400">Speed</span>
          {SPEED_OPTIONS.map(option => (
            <button
              key={option}
              onClick={() => onSpeedChange(option)}
              disabled={disabled}
              className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                speed === option
                  ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/15 bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {option}x
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-gray-500">
          {disabled
            ? 'Animations disabled by reduced-motion preference'
            : isScenarioMode
              ? 'Scenario mode'
              : mode === 'ambient'
                ? 'Ambient mode'
                : 'Animation off'}
        </span>
      </div>

      {currentStep && isScenarioMode && isAnimating && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-gray-300">
          Step {currentStep.index + 1}/{currentStep.total}: {currentStep.label}
        </div>
      )}
    </div>
  );
}
