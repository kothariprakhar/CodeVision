'use client';

import { useEffect, useState } from 'react';
import BusinessFlowView, { BusinessFlow } from './BusinessFlowView';

interface JourneyMapProps {
  projectId: string;
  analysisId: string;
  onSelectModule?: (moduleId: string) => void;
  founderMode?: boolean;
}

export default function JourneyMap({ analysisId, onSelectModule, founderMode = false }: JourneyMapProps) {
  const [flows, setFlows] = useState<BusinessFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!analysisId) return;

    async function fetchFlows() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/analysis/${analysisId}/flows`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch business flows');
        }
        setFlows(data.flows || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch business flows');
      } finally {
        setLoading(false);
      }
    }

    fetchFlows();
  }, [analysisId]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading business flow stories...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return <BusinessFlowView flows={flows} onStepSelect={onSelectModule} founderMode={founderMode} />;
}
