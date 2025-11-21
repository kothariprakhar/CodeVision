'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  analyzed_at: string;
}

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await fetch(`/api/analysis/${projectId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load analysis');
      }
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return '';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'gap' ? 'Missing Feature' : 'Implementation Issue';
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading report...</div>;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            ← Back to Project
          </Link>
        </div>
        <div className="glass rounded-xl p-6 border border-red-500/30 bg-red-500/10 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return <div className="text-center py-12 text-gray-400">No analysis found</div>;
  }

  const criticalCount = analysis.findings.filter(
    f => f.severity === 'critical'
  ).length;
  const highCount = analysis.findings.filter(f => f.severity === 'high').length;
  const mediumCount = analysis.findings.filter(
    f => f.severity === 'medium'
  ).length;
  const lowCount = analysis.findings.filter(f => f.severity === 'low').length;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
        >
          ← Back to Project
        </Link>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <h1 className="text-2xl font-bold gradient-text mb-2">
          Analysis Report
        </h1>
        <p className="text-sm text-gray-500">
          Generated on {new Date(analysis.analyzed_at).toLocaleString()}
        </p>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Executive Summary
        </h2>
        <div className="prose prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
          {analysis.summary}
        </div>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Issues Overview
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="text-2xl font-bold text-red-400">
              {criticalCount}
            </div>
            <div className="text-sm text-red-400/80">Critical</div>
          </div>
          <div className="text-center p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <div className="text-2xl font-bold text-orange-400">{highCount}</div>
            <div className="text-sm text-orange-400/80">High</div>
          </div>
          <div className="text-center p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">
              {mediumCount}
            </div>
            <div className="text-sm text-yellow-400/80">Medium</div>
          </div>
          <div className="text-center p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{lowCount}</div>
            <div className="text-sm text-blue-400/80">Low</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Detailed Findings
        </h2>

        {analysis.findings.length === 0 ? (
          <p className="text-gray-400">
            No issues found. The code appears to align well with the
            requirements.
          </p>
        ) : (
          <div className="space-y-4">
            {analysis.findings.map((finding, index) => (
              <div
                key={index}
                className={`rounded-lg p-4 ${getSeverityClass(finding.severity)}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-white">
                    {finding.title}
                  </h3>
                  <div className="flex gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full bg-white/10 ${getSeverityTextColor(finding.severity)}`}>
                      {finding.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10 text-purple-400">
                      {getTypeLabel(finding.type)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-3">
                  {finding.description}
                </p>
                {finding.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2">
                      Evidence:
                    </p>
                    <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
                      {finding.evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
