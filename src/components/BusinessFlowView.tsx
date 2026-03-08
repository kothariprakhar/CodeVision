'use client';

import { useEffect, useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';

type Domain = 'auth' | 'data' | 'payments' | 'comms' | 'core' | 'infra';

export interface BusinessFlow {
  id: string;
  title: string;
  trigger: string;
  steps: Array<{
    order: number;
    icon: string;
    actor: string;
    action: string;
    detail: string;
    moduleId: string;
    domain: Domain;
  }>;
  outcome: string;
  involvedModules: string[];
}

interface BusinessFlowViewProps {
  flows: BusinessFlow[];
  onStepSelect?: (moduleId: string) => void;
  founderMode?: boolean;
  founderJourneyRewrites?: Record<string, {
    name: string;
    goal: string;
    step_descriptions: Record<string, string>;
  }>;
}

const DOMAIN_COLORS: Record<Domain, string> = {
  auth: 'hsl(220, 80%, 60%)',
  data: 'hsl(160, 70%, 45%)',
  payments: 'hsl(45, 90%, 55%)',
  comms: 'hsl(280, 65%, 55%)',
  core: 'hsl(340, 75%, 55%)',
  infra: 'hsl(200, 20%, 50%)',
};

const ICON_MAP: Record<string, string> = {
  'credit-card': '💳',
  'shield-check': '🛡️',
  bell: '🔔',
  'cog-6-tooth': '⚙️',
  'check-circle': '✅',
  sparkles: '✨',
};

function titleCase(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function stepKey(flowId: string, order: number): string {
  return `${flowId}:${order}`;
}

export default function BusinessFlowView({
  flows,
  onStepSelect,
  founderMode = false,
  founderJourneyRewrites,
}: BusinessFlowViewProps) {
  const [selectedFlowIdState, setSelectedFlowIdState] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

  const selectedFlow = useMemo(() => {
    if (!flows.length) return null;
    if (selectedFlowIdState && flows.some(flow => flow.id === selectedFlowIdState)) {
      return flows.find(flow => flow.id === selectedFlowIdState) || null;
    }
    return flows[0];
  }, [flows, selectedFlowIdState]);

  const selectedFlowId = selectedFlow?.id || null;

  useEffect(() => {
    if (!isPlaying || !selectedFlow || playbackIndex === null) return;

    const interval = setInterval(() => {
      setPlaybackIndex(current => {
        if (current === null) return null;
        const next = current + 1;
        if (next >= selectedFlow.steps.length) {
          setIsPlaying(false);
          return current;
        }
        const step = selectedFlow.steps[next];
        setActiveStepId(stepKey(selectedFlow.id, step.order));
        onStepSelect?.(step.moduleId);
        return next;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, selectedFlow, playbackIndex, onStepSelect]);

  if (!flows.length) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        No business flows available for this analysis.
      </div>
    );
  }

  const handleFlowSelect = (flowId: string): void => {
    setSelectedFlowIdState(flowId);
    setActiveStepId(null);
    setIsPlaying(false);
    setPlaybackIndex(null);
  };

  const handlePlayToggle = (): void => {
    if (!selectedFlow || selectedFlow.steps.length === 0) return;

    setIsPlaying(prev => {
      const next = !prev;
      if (next) {
        const first = selectedFlow.steps[0];
        setPlaybackIndex(0);
        setActiveStepId(stepKey(selectedFlow.id, first.order));
        onStepSelect?.(first.moduleId);
      } else {
        setPlaybackIndex(null);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center gap-2">
          {flows.map(flow => (
            <button
              key={flow.id}
              onClick={() => handleFlowSelect(flow.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedFlowId === flow.id
                  ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/15 bg-white/[0.02] text-gray-300 hover:border-white/35'
              }`}
            >
              {flow.title}
            </button>
          ))}
          <button
            onClick={handlePlayToggle}
            className={`ml-auto rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              isPlaying
                ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100'
                : 'border-white/20 bg-white/[0.03] text-gray-200 hover:border-white/40'
            }`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>
      </div>

      {selectedFlow && (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] to-white/[0.01] p-4">
          <h3 className="text-lg font-semibold text-white">
            {founderMode && founderJourneyRewrites?.[selectedFlow.id]?.name
              ? founderJourneyRewrites[selectedFlow.id].name
              : selectedFlow.title}
          </h3>
          <p className="mt-1 text-sm text-gray-300">
            {founderMode && founderJourneyRewrites?.[selectedFlow.id]?.goal
              ? founderJourneyRewrites[selectedFlow.id].goal
              : simplifyForFounder(selectedFlow.trigger, founderMode)}
          </p>

          <div className="relative mt-6 pl-2">
            <div className="absolute left-[26px] top-3 bottom-2 w-[2px] rounded-full bg-white/10" />
            <div className="space-y-3">
              {selectedFlow.steps.map((step, index) => {
                const id = stepKey(selectedFlow.id, step.order);
                const active = activeStepId === id;
                const alignRight = index % 2 === 1;
                const domainColor = DOMAIN_COLORS[step.domain];
                return (
                  <div
                    key={id}
                    className={`relative flex ${alignRight ? 'justify-end' : 'justify-start'} transition-all duration-300`}
                    style={{
                      opacity: 1,
                      transform: 'translateX(0)',
                      transitionDelay: `${index * 40}ms`,
                    }}
                  >
                    <button
                      onClick={() => {
                        setActiveStepId(id);
                        setIsPlaying(false);
                        setPlaybackIndex(index);
                        onStepSelect?.(step.moduleId);
                      }}
                      className={`relative w-full max-w-[86%] rounded-xl border p-3 text-left shadow-md transition-all ${
                        active
                          ? 'border-white/55 bg-white/[0.14]'
                          : 'border-white/15 bg-black/30 hover:border-white/35'
                      }`}
                      style={{
                        boxShadow: active
                          ? `0 0 0 1px ${domainColor}66, 0 0 28px ${domainColor}2B`
                          : `0 0 0 1px ${domainColor}22`,
                      }}
                    >
                      <span
                        className="absolute -left-7 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/80 text-base"
                        style={{ boxShadow: `0 0 0 1px ${domainColor}55` }}
                      >
                        {ICON_MAP[step.icon] || '✨'}
                      </span>
                      <div className="text-xs uppercase tracking-wide text-gray-400">
                        Step {step.order} · {titleCase(step.domain)}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {step.actor}: {step.action}
                      </div>
                      <div className="mt-1 text-xs text-gray-300">
                        {founderMode && founderJourneyRewrites?.[selectedFlow.id]?.step_descriptions
                          ? (
                            founderJourneyRewrites[selectedFlow.id].step_descriptions[String(step.order)]
                            || founderJourneyRewrites[selectedFlow.id].step_descriptions[step.moduleId]
                            || simplifyForFounder(step.detail, founderMode)
                          )
                          : simplifyForFounder(step.detail, founderMode)}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
            <div className="font-semibold text-white">Outcome</div>
            <div className="mt-1">
              {founderMode && founderJourneyRewrites?.[selectedFlow.id]?.goal
                ? founderJourneyRewrites[selectedFlow.id].goal
                : simplifyForFounder(selectedFlow.outcome, founderMode)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
