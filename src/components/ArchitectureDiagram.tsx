'use client';

import { useState, useMemo, useCallback } from 'react';

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

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
}

export default function ArchitectureDiagram({ architecture }: ArchitectureDiagramProps) {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Map architecture nodes to MVC layers
  const mvcComponents = useMemo(() => {
    if (!architecture?.nodes) return [];

    return architecture.nodes.map((node): MVCComponent => {
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
  }, [architecture]);

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
    if (!componentId || !architecture) return [];

    const component = mvcComponents.find(c => c.id === componentId);
    if (!component) return [];

    const affectedLayers = new Set<MVCLayer>([component.layer]);

    const findConnected = (nodeId: string, visited: Set<string>) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      architecture.edges.forEach(edge => {
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
  }, [architecture, mvcComponents]);

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

  const selectedComponentData = selectedComponent
    ? mvcComponents.find(c => c.id === selectedComponent)
    : null;

  const affectedLayers = selectedComponent ? getAffectedLayers(selectedComponent) : [];
  const layerCount = affectedLayers.length;

  if (!architecture || architecture.nodes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No architecture data available
      </div>
    );
  }

  return (
    <div>
      {/* Simple Summary Stats */}
      <div className="mb-4 text-sm text-gray-400">
        View: {componentsByLayer.view.length} | Controller: {componentsByLayer.controller.length} | Model: {componentsByLayer.model.length}
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Left: MVC Flow Diagram */}
        <div className="flex-1">
          {/* Horizontal Flow */}
          <div className="flex items-center justify-between mb-6">
            {/* View Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-purple-400 text-sm">View</h3>
                <p className="text-xs text-gray-500">UI</p>
              </div>
            </div>

            <div className="px-2 text-gray-500">
              <svg width="30" height="16" viewBox="0 0 30 16">
                <line x1="0" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,4 30,8 22,12" fill="currentColor" />
              </svg>
            </div>

            {/* Controller Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-blue-400 text-sm">Controller</h3>
                <p className="text-xs text-gray-500">API</p>
              </div>
            </div>

            <div className="px-2 text-gray-500">
              <svg width="30" height="16" viewBox="0 0 30 16">
                <line x1="0" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,4 30,8 22,12" fill="currentColor" />
              </svg>
            </div>

            {/* Model Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-green-400 text-sm">Model</h3>
                <p className="text-xs text-gray-500">Data</p>
              </div>
            </div>
          </div>

          {/* Component Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* View Components */}
            <div className="space-y-2">
              {componentsByLayer.view.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.view.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-purple-500/20 border-purple-500 ring-1 ring-purple-500/50'
                        : 'bg-white/5 border-white/10 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{comp.files.length} files</span>
                      <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                        {comp.complexity}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Controller Components */}
            <div className="space-y-2">
              {componentsByLayer.controller.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.controller.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-blue-500/20 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{comp.files.length} files</span>
                      <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                        {comp.complexity}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Model Components */}
            <div className="space-y-2">
              {componentsByLayer.model.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.model.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-green-500/20 border-green-500 ring-1 ring-green-500/50'
                        : 'bg-white/5 border-white/10 hover:border-green-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{comp.files.length} files</span>
                      <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                        {comp.complexity}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="w-64 flex-shrink-0">
          <div className="p-3 rounded-xl border bg-white/5 border-white/10 min-h-[200px]">
            {selectedComponentData ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-white text-sm">{selectedComponentData.name}</h3>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-xs text-gray-300">
                    {selectedComponentData.description || 'No description'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Files ({selectedComponentData.files.length})</div>
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {selectedComponentData.files.map((file, i) => (
                      <div key={i} className="text-xs text-gray-400 truncate">{file}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Impact</div>
                  <div className={`text-xs font-medium ${
                    layerCount === 1 ? 'text-green-400' :
                    layerCount === 2 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {layerCount} layer{layerCount !== 1 ? 's' : ''} affected
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                Click a component
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
