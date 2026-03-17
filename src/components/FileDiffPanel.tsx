'use client';

import { useMemo, useState } from 'react';

type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

interface FileDiff {
  path: string;
  status: DiffChangeType;
  module_id?: string;
}

interface FileDiffPanelProps {
  files: FileDiff[];
  moduleNames?: Record<string, string>;
}

const STATUS_COLORS: Record<DiffChangeType, string> = {
  added: 'text-emerald-300',
  removed: 'text-red-300',
  modified: 'text-amber-300',
  unchanged: 'text-gray-500',
};

const STATUS_ICONS: Record<DiffChangeType, string> = {
  added: '+',
  removed: '−',
  modified: '~',
  unchanged: ' ',
};

export default function FileDiffPanel({ files, moduleNames = {} }: FileDiffPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const grouped = useMemo(() => {
    const groups = new Map<string, FileDiff[]>();
    for (const file of files) {
      const moduleKey = file.module_id
        ? (moduleNames[file.module_id] || file.module_id)
        : 'Unassigned';
      if (!groups.has(moduleKey)) groups.set(moduleKey, []);
      groups.get(moduleKey)!.push(file);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [files, moduleNames]);

  const counts = useMemo(() => ({
    added: files.filter(f => f.status === 'added').length,
    removed: files.filter(f => f.status === 'removed').length,
    modified: files.filter(f => f.status === 'modified').length,
  }), [files]);

  if (files.length === 0) return null;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">File Changes</span>
          <span className="text-[10px] text-gray-400">
            {files.length} files
          </span>
        </div>
        <div className="flex items-center gap-3">
          {counts.added > 0 && (
            <span className="text-[10px] text-emerald-300">+{counts.added}</span>
          )}
          {counts.removed > 0 && (
            <span className="text-[10px] text-red-300">−{counts.removed}</span>
          )}
          {counts.modified > 0 && (
            <span className="text-[10px] text-amber-300">~{counts.modified}</span>
          )}
          <span className="text-xs text-gray-500">{isOpen ? '−' : '+'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-white/5 px-4 pb-4 pt-2">
          {grouped.map(([moduleName, moduleFiles]) => (
            <div key={moduleName} className="mt-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                {moduleName}
              </div>
              <div className="mt-1 space-y-0.5">
                {moduleFiles.map((file) => (
                  <div key={file.path} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={`w-3 text-center font-bold ${STATUS_COLORS[file.status]}`}>
                      {STATUS_ICONS[file.status]}
                    </span>
                    <span className={STATUS_COLORS[file.status]}>{file.path}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
