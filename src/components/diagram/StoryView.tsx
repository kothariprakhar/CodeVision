'use client';

import { useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';
import type { BusinessFlow } from '@/components/BusinessFlowView';
import type { ArchitectureVisualization, BusinessContext } from './types';

interface StoryViewProps {
  architecture: ArchitectureVisualization;
  flows: BusinessFlow[];
  founderMode?: boolean;
  businessContext?: BusinessContext | null;
}

export default function StoryView({
  architecture,
  flows,
  founderMode = false,
  businessContext,
}: StoryViewProps) {
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const nodeByName = useMemo(() => {
    const map = new Map<string, ArchitectureVisualization['nodes'][number]>();
    architecture.nodes.forEach((node) => {
      map.set(node.name.toLowerCase(), node);
      map.set(node.id.toLowerCase(), node);
    });
    return map;
  }, [architecture.nodes]);

  const activeNarrative = founderMode
    ? businessContext?.founder_narrative
    : businessContext?.technical_narrative;

  const components = activeNarrative?.components || [];

  if (!businessContext) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        Run analysis to generate a story view of this system&apos;s architecture.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-2">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold text-white">What This Product Does</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          {simplifyForFounder(businessContext.problem_statement, founderMode)}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-base font-semibold text-white">How It Works</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
          {activeNarrative?.how_it_works || simplifyForFounder('Architecture story is not available for this analysis version.', true)}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-base font-semibold text-white">The Building Blocks</h3>
        <div className="mt-4 space-y-3">
          {components.length === 0 && (
            <p className="text-sm text-gray-400">No narrative components were generated for this version.</p>
          )}
          {components.map((component) => {
            const node = nodeByName.get(component.name.toLowerCase());
            const expanded = expandedModuleId === component.name;
            return (
              <article key={component.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => setExpandedModuleId(expanded ? null : component.name)}
                  className="w-full text-left"
                >
                  <div className="text-sm font-semibold text-white">{component.name}</div>
                  <div className="mt-1 text-sm text-gray-300">
                    {simplifyForFounder(component.explanation, founderMode)}
                  </div>
                  <div className="mt-2 text-xs text-indigo-200">
                    Analogy: {simplifyForFounder(component.business_analogy, founderMode)}
                  </div>
                </button>
                {expanded && node && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-gray-300">
                    <div>{node.files?.length || 0} files</div>
                    <div className="mt-1">Complexity: {node.complexity}</div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-base font-semibold text-white">How Users Move Through the System</h3>
        <div className="mt-4 space-y-4">
          {flows.length === 0 && (
            <p className="text-sm text-gray-400">No user journeys available for this analysis version.</p>
          )}
          {flows.map((flow) => (
            <article key={flow.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <h4 className="text-sm font-semibold text-white">{flow.title}</h4>
              <p className="mt-1 text-xs text-gray-400">{simplifyForFounder(flow.trigger, founderMode)}</p>
              <ol className="mt-3 space-y-2 text-sm text-gray-300">
                {flow.steps
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((step) => (
                    <li key={`${flow.id}-${step.order}`}>
                      <span className="font-semibold text-gray-100">{step.actor}:</span>{' '}
                      {simplifyForFounder(step.action, founderMode)}.{' '}
                      {simplifyForFounder(step.detail || '', founderMode)}
                      {step.data_passed && (
                        <span className="text-emerald-300"> Data passed: {simplifyForFounder(step.data_passed, founderMode)}.</span>
                      )}
                    </li>
                  ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      {activeNarrative?.scale_assessment && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-base font-semibold text-white">Can It Scale?</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {simplifyForFounder(activeNarrative.scale_assessment, founderMode)}
          </p>
        </section>
      )}
    </div>
  );
}

