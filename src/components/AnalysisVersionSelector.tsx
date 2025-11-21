'use client';

interface Version {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
}

interface AnalysisVersionSelectorProps {
  versions: Version[];
  selectedVersion: string;
  onChange: (versionId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AnalysisVersionSelector({
  versions,
  selectedVersion,
  onChange,
}: AnalysisVersionSelectorProps) {
  if (versions.length === 0) {
    return null;
  }

  const selectedVersionData = versions.find(v => v.id === selectedVersion);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-400">Version:</label>
      <select
        value={selectedVersion}
        onChange={e => onChange(e.target.value)}
        className="input-dark rounded-lg px-3 py-1.5 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        {versions.map(version => (
          <option key={version.id} value={version.id}>
            {version.is_latest ? 'Latest - ' : ''}
            {formatDate(version.analyzed_at)}
          </option>
        ))}
      </select>
      {selectedVersionData && (
        <span className="text-xs text-gray-500">
          ({formatRelativeTime(selectedVersionData.analyzed_at)})
        </span>
      )}
    </div>
  );
}
