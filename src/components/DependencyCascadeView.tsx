'use client';

import { useState } from 'react';

interface DependencyCascade {
  changed_module_id: string;
  changed_module_name: string;
  directly_affected: string[];
  transitively_affected: string[];
  total_blast_radius: number;
}

interface DependencyCascadeViewProps {
  cascades: DependencyCascade[];
}

export default function DependencyCascadeView({ cascades }: DependencyCascadeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (cascades.length === 0) return null;

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-sm font-semibold text-white">Dependency Cascade</div>
      <div className="mt-1 text-[11px] text-gray-500">
        Blast radius of changed modules through the dependency graph
      </div>

      <div className="mt-3 space-y-2">
        {cascades.map((cascade) => {
          const isOpen = expanded.has(cascade.changed_module_id);
          return (
            <div
              key={cascade.changed_module_id}
              className="rounded-lg border border-white/10 bg-black/20"
            >
              <button
                onClick={() => toggle(cascade.changed_module_id)}
                className="flex w-full items-center justify-between p-3 text-left"
              >
                <div>
                  <span className="text-xs font-semibold text-white">{cascade.changed_module_name}</span>
                  <span className="ml-2 text-[10px] text-gray-400">
                    {cascade.directly_affected.length} direct, {cascade.transitively_affected.length} transitive
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    Blast: {cascade.total_blast_radius}
                  </span>
                  <span className="text-xs text-gray-500">{isOpen ? '−' : '+'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/5 px-3 pb-3 pt-2">
                  {cascade.directly_affected.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Directly Affected
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cascade.directly_affected.map((name) => (
                          <span
                            key={name}
                            className="rounded bg-orange-500/15 px-2 py-0.5 text-[10px] text-orange-300"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {cascade.transitively_affected.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Transitively Affected
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {cascade.transitively_affected.map((name) => (
                          <span
                            key={name}
                            className="rounded bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
