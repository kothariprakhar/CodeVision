'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

interface ArchitectureNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  files: string[];
}

interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
}

interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  analyzed_at: string;
}

type MVCLayer = 'view' | 'controller' | 'model';

interface MVCComponent {
  id: string;
  name: string;
  layer: MVCLayer;
  originalType: string;
  complexity: 'low' | 'medium' | 'high';
  files: string[];
  description: string;
}

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

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

  // Map architecture nodes to MVC layers
  const mvcComponents = useMemo(() => {
    if (!analysis?.architecture?.nodes) return [];

    return analysis.architecture.nodes.map((node): MVCComponent => {
      let layer: MVCLayer = 'controller';

      if (node.type === 'ui' || node.type === 'component') {
        layer = 'view';
      } else if (node.type === 'api') {
        layer = 'controller';
      } else if (node.type === 'service' || node.type === 'database') {
        layer = 'model';
      } else if (node.type === 'external') {
        layer = 'model';
      }

      return {
        id: node.id,
        name: node.name,
        layer,
        originalType: node.type,
        complexity: node.complexity,
        files: node.files,
        description: node.description,
      };
    });
  }, [analysis]);

  // Group components by layer
  const componentsByLayer = useMemo(() => {
    const grouped = {
      view: [] as MVCComponent[],
      controller: [] as MVCComponent[],
      model: [] as MVCComponent[],
    };

    mvcComponents.forEach(comp => {
      grouped[comp.layer].push(comp);
    });

    return grouped;
  }, [mvcComponents]);

  // Get layers affected by selected component
  const getAffectedLayers = useCallback((componentId: string | null) => {
    if (!componentId || !analysis?.architecture) return [];

    const component = mvcComponents.find(c => c.id === componentId);
    if (!component) return [];

    const affectedLayers = new Set<MVCLayer>([component.layer]);

    // Find all connected components through edges
    const findConnected = (nodeId: string, visited: Set<string>) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      analysis.architecture.edges.forEach(edge => {
        if (edge.from === nodeId) {
          const targetComp = mvcComponents.find(c => c.id === edge.to);
          if (targetComp) {
            affectedLayers.add(targetComp.layer);
            findConnected(edge.to, visited);
          }
        }
        if (edge.to === nodeId) {
          const sourceComp = mvcComponents.find(c => c.id === edge.from);
          if (sourceComp) {
            affectedLayers.add(sourceComp.layer);
            findConnected(edge.from, visited);
          }
        }
      });
    };

    findConnected(componentId, new Set());

    return Array.from(affectedLayers);
  }, [analysis, mvcComponents]);

  const getComplexityBadge = (complexity: 'low' | 'medium' | 'high') => {
    switch (complexity) {
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
  };

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

  const selectedComponentData = selectedComponent
    ? mvcComponents.find(c => c.id === selectedComponent)
    : null;

  const affectedLayers = selectedComponent ? getAffectedLayers(selectedComponent) : [];
  const layerCount = affectedLayers.length;

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

      {/* Simplified MVC Architecture Visualization */}
      {analysis.architecture && analysis.architecture.nodes.length > 0 && (
        <div className="glass rounded-xl p-6 mb-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-2">
              Architecture Overview
            </h2>
            <p className="text-sm text-gray-400">
              Click on a component to see its details and impact
            </p>
          </div>

          {/* Simple Summary Stats */}
          <div className="mb-6 text-sm text-gray-400">
            View: {componentsByLayer.view.length} components | Controller: {componentsByLayer.controller.length} components | Model: {componentsByLayer.model.length} components
          </div>

          {/* Main Layout: MVC Flow + Detail Panel */}
          <div className="flex gap-6">
            {/* Left: MVC Flow Diagram */}
            <div className="flex-1">
              {/* Horizontal Flow Diagram */}
              <div className="flex items-center justify-between mb-8">
                {/* View Layer Box */}
                <div className="flex-1 p-4 rounded-xl border backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                    borderColor: 'rgba(168, 85, 247, 0.3)',
                  }}>
                  <div className="text-center mb-2">
                    <h3 className="font-semibold text-purple-400">View Layer</h3>
                    <p className="text-xs text-gray-500">UI &amp; Pages</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="px-4 text-gray-500">
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <line x1="0" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="2" />
                    <polygon points="30,5 40,10 30,15" fill="currentColor" />
                  </svg>
                </div>

                {/* Controller Layer Box */}
                <div className="flex-1 p-4 rounded-xl border backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                  }}>
                  <div className="text-center mb-2">
                    <h3 className="font-semibold text-blue-400">Controller Layer</h3>
                    <p className="text-xs text-gray-500">API Routes</p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="px-4 text-gray-500">
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <line x1="0" y1="10" x2="30" y2="10" stroke="currentColor" strokeWidth="2" />
                    <polygon points="30,5 40,10 30,15" fill="currentColor" />
                  </svg>
                </div>

                {/* Model Layer Box */}
                <div className="flex-1 p-4 rounded-xl border backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                    borderColor: 'rgba(34, 197, 94, 0.3)',
                  }}>
                  <div className="text-center mb-2">
                    <h3 className="font-semibold text-green-400">Model Layer</h3>
                    <p className="text-xs text-gray-500">Data &amp; Logic</p>
                  </div>
                </div>
              </div>

              {/* Component Cards by Layer */}
              <div className="grid grid-cols-3 gap-4">
                {/* View Components */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-purple-400 mb-2">View Components</div>
                  {componentsByLayer.view.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">None</div>
                  ) : (
                    componentsByLayer.view.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedComponent === comp.id
                            ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/50'
                            : 'bg-white/5 border-white/10 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="font-medium text-sm text-white truncate">{comp.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{comp.files.length} files</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                            {comp.complexity}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Controller Components */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-blue-400 mb-2">Controller Components</div>
                  {componentsByLayer.controller.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">None</div>
                  ) : (
                    componentsByLayer.controller.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedComponent === comp.id
                            ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/50'
                            : 'bg-white/5 border-white/10 hover:border-blue-500/50'
                        }`}
                      >
                        <div className="font-medium text-sm text-white truncate">{comp.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{comp.files.length} files</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                            {comp.complexity}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Model Components */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-green-400 mb-2">Model Components</div>
                  {componentsByLayer.model.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">None</div>
                  ) : (
                    componentsByLayer.model.map(comp => (
                      <button
                        key={comp.id}
                        onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedComponent === comp.id
                            ? 'bg-green-500/20 border-green-500 ring-2 ring-green-500/50'
                            : 'bg-white/5 border-white/10 hover:border-green-500/50'
                        }`}
                      >
                        <div className="font-medium text-sm text-white truncate">{comp.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">{comp.files.length} files</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                            {comp.complexity}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right: Fixed Detail Panel */}
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-6 p-4 rounded-xl border bg-white/5 border-white/10 min-h-[300px]">
                {selectedComponentData ? (
                  <>
                    <h3 className="font-semibold text-white mb-3">{selectedComponentData.name}</h3>

                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Description</div>
                        <div className="text-sm text-gray-300">
                          {selectedComponentData.description || 'No description available'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Complexity</div>
                        <span className={`text-xs px-2 py-1 rounded border ${getComplexityBadge(selectedComponentData.complexity)}`}>
                          {selectedComponentData.complexity}
                        </span>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Files ({selectedComponentData.files.length})</div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {selectedComponentData.files.map((file, i) => (
                            <div key={i} className="text-xs text-gray-400 truncate">{file}</div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-2">Layers Affected</div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              affectedLayers.includes('view')
                                ? 'bg-purple-500 border-purple-500'
                                : 'border-gray-600'
                            }`} />
                            <span className="text-xs text-gray-400">V</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              affectedLayers.includes('controller')
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-600'
                            }`} />
                            <span className="text-xs text-gray-400">C</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              affectedLayers.includes('model')
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-600'
                            }`} />
                            <span className="text-xs text-gray-400">M</span>
                          </div>
                        </div>
                        <div className={`mt-2 text-xs font-medium ${
                          layerCount === 1 ? 'text-green-400' :
                          layerCount === 2 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {layerCount} layer{layerCount !== 1 ? 's' : ''} affected
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                    Click a component to see details
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature Effort Indicator */}
          <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="text-sm font-medium text-white mb-3">Feature Effort Guide</div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">1 layer affected</span>
                <span className="text-gray-400">= Easy change (hours)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-yellow-400 font-medium">2 layers affected</span>
                <span className="text-gray-400">= Medium change (days)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-red-400 font-medium">3 layers affected</span>
                <span className="text-gray-400">= Hard change (week+)</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
