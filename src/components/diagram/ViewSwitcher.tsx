'use client';

export type DiagramView = 'graph' | 'metro' | 'story' | 'live';

interface ViewSwitcherProps {
  activeView: DiagramView;
  onViewChange: (view: DiagramView) => void;
  disabled?: boolean;
}

const VIEWS: Array<{ id: DiagramView; icon: string; label: string; persona: string }> = [
  { id: 'graph', icon: '🔲', label: 'Graph', persona: 'Engineering' },
  { id: 'metro', icon: '🚇', label: 'Flow Map', persona: 'Product' },
  { id: 'story', icon: '📖', label: 'Story', persona: 'Founder' },
  { id: 'live', icon: '💓', label: 'Live', persona: 'Demo' },
];

export default function ViewSwitcher({ activeView, onViewChange, disabled = false }: ViewSwitcherProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((view) => {
          const active = view.id === activeView;
          return (
            <button
              key={view.id}
              type="button"
              disabled={disabled}
              onClick={() => onViewChange(view.id)}
              className={`group relative rounded-xl border px-3 py-2 text-left transition-all ${
                active
                  ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/15 bg-white/[0.02] text-gray-300 hover:border-white/30 hover:bg-white/[0.05]'
              }`}
            >
              <div className="text-sm font-semibold">
                {view.icon} {view.label}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                {view.persona}
              </div>
              <span
                className={`absolute bottom-0 left-3 right-3 h-[2px] rounded-full transition-opacity ${
                  active ? 'bg-indigo-300 opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

