'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/* ─────────────────────── colour palette ─────────────────────── */
const COLORS = {
  bg: '#0a0e1a',
  card: 'rgba(15, 23, 42, 0.85)',
  border: 'rgba(99, 102, 241, 0.2)',
  borderHover: 'rgba(99, 102, 241, 0.5)',
  accent: '#818cf8',
  accentDim: 'rgba(129, 140, 248, 0.15)',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  green: '#34d399',
  greenDim: 'rgba(52, 211, 153, 0.15)',
  blue: '#60a5fa',
  blueDim: 'rgba(96, 165, 250, 0.15)',
  orange: '#fb923c',
  orangeDim: 'rgba(251, 146, 60, 0.15)',
  purple: '#a78bfa',
  purpleDim: 'rgba(167, 139, 250, 0.15)',
  pink: '#f472b6',
  pinkDim: 'rgba(244, 114, 182, 0.15)',
  cyan: '#22d3ee',
  cyanDim: 'rgba(34, 211, 238, 0.15)',
  red: '#f87171',
  redDim: 'rgba(248, 113, 113, 0.15)',
  yellow: '#fbbf24',
  yellowDim: 'rgba(251, 191, 36, 0.15)',
};

/* ─────────────────────── section selector ─────────────────────── */
type Section = 'overview' | 'pipeline' | 'ai-engine' | 'frontend' | 'api' | 'tech';

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'System Overview', icon: '🏗️' },
  { id: 'pipeline', label: 'Data Pipeline', icon: '🔄' },
  { id: 'ai-engine', label: 'AI Analysis Engine', icon: '🧠' },
  { id: 'frontend', label: 'Frontend Architecture', icon: '🖥️' },
  { id: 'api', label: 'API Layer', icon: '🔌' },
  { id: 'tech', label: 'Technology Stack', icon: '⚙️' },
];

/* ─────────────────────── SVG helpers ─────────────────────── */
interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  colorDim: string;
  icon: string;
  desc: string;
  group?: string;
}

interface EdgeData {
  from: string;
  to: string;
  label?: string;
  color?: string;
  dashed?: boolean;
  animated?: boolean;
}

function getCenter(n: NodeData) {
  return { cx: n.x + n.w / 2, cy: n.y + n.h / 2 };
}

/* ─────────────────────── InteractiveGraph ─────────────────────── */
function InteractiveGraph({
  nodes,
  edges,
  width,
  height,
  selected,
  onSelect,
  title,
  subtitle,
  groupLabels,
}: {
  nodes: NodeData[];
  edges: EdgeData[];
  width: number;
  height: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  title: string;
  subtitle?: string;
  groupLabels?: { label: string; x: number; y: number; w: number; h: number; color: string }[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    setAnimationKey(k => k + 1);
  }, []);

  const activeNode = hoveredNode || selected;

  return (
    <div className="relative">
      {title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold" style={{ color: COLORS.text }}>{title}</h3>
          {subtitle && <p className="text-sm mt-1" style={{ color: COLORS.textDim }}>{subtitle}</p>}
        </div>
      )}
      <div
        className="relative overflow-x-auto rounded-2xl"
        style={{ border: `1px solid ${COLORS.border}`, background: COLORS.bg }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ minWidth: 700 }}
          onClick={() => onSelect(null)}
        >
          <defs>
            {/* glow filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* animated dash */}
            <style>{`
              @keyframes dashFlow { to { stroke-dashoffset: -20; } }
              .dash-animate { animation: dashFlow 1s linear infinite; }
              @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
              .node-fade-in { animation: fadeIn 0.5s ease-out both; }
            `}</style>
            {/* arrowhead markers */}
            {['#818cf8', '#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f472b6', '#22d3ee', '#94a3b8', '#fbbf24'].map(c => (
              <marker key={c} id={`arrow-${c.replace('#', '')}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* Grid background */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="none" stroke="rgba(99,102,241,0.04)" strokeWidth="0.5" />
          </pattern>
          <rect width={width} height={height} fill="url(#grid)" />

          {/* Group labels / zones */}
          {groupLabels?.map((g, i) => (
            <g key={i}>
              <rect
                x={g.x}
                y={g.y}
                width={g.w}
                height={g.h}
                rx="16"
                fill={g.color}
                stroke={g.color.replace('0.06', '0.15')}
                strokeWidth="1"
                strokeDasharray="6 4"
              />
              <text x={g.x + 16} y={g.y + 24} fill={COLORS.textDim} fontSize="11" fontWeight="600" textAnchor="start" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {g.label}
              </text>
            </g>
          ))}

          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            const { cx: x1, cy: y1 } = getCenter(from);
            const { cx: x2, cy: y2 } = getCenter(to);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / dist;
            const ny = dy / dist;
            const sx = x1 + nx * (from.w / 2 + 4);
            const sy = y1 + ny * (from.h / 2 + 4);
            const ex = x2 - nx * (to.w / 2 + 4);
            const ey = y2 - ny * (to.h / 2 + 4);
            // gentle curve offset
            const mx = (sx + ex) / 2 - ny * 20;
            const my = (sy + ey) / 2 + nx * 20;
            const col = e.color || '#94a3b8';
            const isHighlighted = activeNode === e.from || activeNode === e.to;
            const opacity = activeNode ? (isHighlighted ? 1 : 0.15) : 0.6;
            const arrowId = `arrow-${col.replace('#', '')}`;

            return (
              <g key={i}>
                <path
                  d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                  fill="none"
                  stroke={col}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={e.dashed ? '6 4' : undefined}
                  className={e.animated ? 'dash-animate' : undefined}
                  opacity={opacity}
                  markerEnd={`url(#${arrowId})`}
                  style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
                />
                {e.label && (
                  <text
                    x={mx}
                    y={my - 6}
                    fill={col}
                    fontSize="9"
                    textAnchor="middle"
                    opacity={opacity}
                    style={{ transition: 'opacity 0.3s' }}
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const isActive = activeNode === node.id;
            const isConnected =
              activeNode &&
              edges.some(
                e =>
                  (e.from === activeNode && e.to === node.id) ||
                  (e.to === activeNode && e.from === node.id)
              );
            const opacity = activeNode ? (isActive || isConnected ? 1 : 0.25) : 1;

            return (
              <g
                key={node.id}
                className="node-fade-in cursor-pointer"
                style={{ animationDelay: `${i * 0.06}s`, transition: 'opacity 0.3s' }}
                opacity={opacity}
                onClick={ev => {
                  ev.stopPropagation();
                  onSelect(isActive ? null : node.id);
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* glow */}
                {isActive && (
                  <rect
                    x={node.x - 4}
                    y={node.y - 4}
                    width={node.w + 8}
                    height={node.h + 8}
                    rx="16"
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2"
                    opacity="0.5"
                    filter="url(#glow)"
                  />
                )}
                {/* background */}
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={node.h}
                  rx="12"
                  fill={isActive ? node.colorDim : COLORS.card}
                  stroke={isActive ? node.color : COLORS.border}
                  strokeWidth={isActive ? 2 : 1}
                  style={{ transition: 'fill 0.3s, stroke 0.3s' }}
                />
                {/* icon */}
                <text
                  x={node.x + node.w / 2}
                  y={node.y + node.h / 2 - 8}
                  textAnchor="middle"
                  fontSize="22"
                  dominantBaseline="middle"
                >
                  {node.icon}
                </text>
                {/* label */}
                <text
                  x={node.x + node.w / 2}
                  y={node.y + node.h / 2 + 14}
                  textAnchor="middle"
                  fill={isActive ? node.color : COLORS.text}
                  fontSize="11"
                  fontWeight="600"
                  style={{ transition: 'fill 0.3s' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* detail tooltip */}
        {selected && (() => {
          const n = nodes.find(n => n.id === selected);
          if (!n) return null;
          const connectedEdges = edges.filter(e => e.from === selected || e.to === selected);
          return (
            <div
              className="absolute top-4 right-4 rounded-xl p-4 max-w-xs backdrop-blur-xl"
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: `1px solid ${n.color}`,
                boxShadow: `0 0 30px ${n.colorDim}`,
              }}
              onClick={ev => ev.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{n.icon}</span>
                <h4 className="text-base font-bold" style={{ color: n.color }}>{n.label}</h4>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textDim }}>{n.desc}</p>
              {connectedEdges.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: COLORS.textDim, letterSpacing: '0.08em' }}>Connections</p>
                  {connectedEdges.map((e, i) => {
                    const other = nodes.find(nn => nn.id === (e.from === selected ? e.to : e.from));
                    if (!other) return null;
                    const dir = e.from === selected ? '→' : '←';
                    return (
                      <div key={i} className="text-xs flex items-center gap-1 py-0.5" style={{ color: COLORS.text }}>
                        <span style={{ color: other.color }}>{dir}</span> {other.label}
                        {e.label && <span className="ml-1 opacity-50">({e.label})</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ─────────────────── Pipeline Step ─────────────────── */
function PipelineStep({
  step,
  index,
  total,
  isActive,
  onClick,
}: {
  step: {
    title: string;
    icon: string;
    desc: string;
    detail: string;
    color: string;
    colorDim: string;
    tools: string[];
  };
  index: number;
  total: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start gap-4">
      {/* timeline */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg cursor-pointer transition-all duration-300"
          style={{
            background: isActive ? step.colorDim : COLORS.card,
            border: `2px solid ${isActive ? step.color : COLORS.border}`,
            boxShadow: isActive ? `0 0 20px ${step.colorDim}` : 'none',
          }}
          onClick={onClick}
        >
          {step.icon}
        </div>
        {index < total - 1 && (
          <div className="w-0.5 flex-1 min-h-[60px]" style={{ background: `linear-gradient(to bottom, ${step.color}40, ${COLORS.border})` }} />
        )}
      </div>
      {/* content */}
      <div
        className="flex-1 rounded-xl p-4 mb-4 cursor-pointer transition-all duration-300"
        style={{
          background: isActive ? step.colorDim : COLORS.card,
          border: `1px solid ${isActive ? step.color : COLORS.border}`,
        }}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: step.colorDim, color: step.color }}>
            Step {index + 1}
          </span>
          <h4 className="text-sm font-bold" style={{ color: isActive ? step.color : COLORS.text }}>{step.title}</h4>
        </div>
        <p className="text-xs leading-relaxed mb-2" style={{ color: COLORS.textDim }}>{step.desc}</p>
        {isActive && (
          <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${step.color}20` }}>
            <p className="text-xs leading-relaxed mb-2" style={{ color: COLORS.text }}>{step.detail}</p>
            <div className="flex flex-wrap gap-1">
              {step.tools.map(t => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: COLORS.accent, border: `1px solid ${COLORS.border}` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────── AI Pass Card ─────────────────── */
function AIPassCard({
  pass,
  isActive,
  onClick,
}: {
  pass: {
    num: number;
    title: string;
    icon: string;
    color: string;
    colorDim: string;
    input: string;
    output: string;
    tokens: string;
    model: string;
    detail: string;
  };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="rounded-xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden"
      style={{
        background: isActive ? pass.colorDim : COLORS.card,
        border: `1px solid ${isActive ? pass.color : COLORS.border}`,
        boxShadow: isActive ? `0 0 40px ${pass.colorDim}` : 'none',
      }}
      onClick={onClick}
    >
      {/* background number */}
      <span
        className="absolute -right-2 -top-4 text-8xl font-black pointer-events-none select-none"
        style={{ color: pass.color, opacity: 0.06 }}
      >
        {pass.num}
      </span>
      <div className="relative">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{pass.icon}</span>
          <div>
            <p className="text-[10px] font-semibold uppercase" style={{ color: pass.color, letterSpacing: '0.1em' }}>Pass {pass.num}</p>
            <h4 className="text-base font-bold" style={{ color: COLORS.text }}>{pass.title}</h4>
          </div>
        </div>
        <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textDim }}>{pass.detail}</p>

        {isActive && (
          <div className="space-y-2 mt-3 pt-3" style={{ borderTop: `1px solid ${pass.color}20` }}>
            <div className="flex gap-2">
              <span className="text-[10px] uppercase font-semibold shrink-0 w-14" style={{ color: pass.color }}>Input</span>
              <span className="text-xs" style={{ color: COLORS.text }}>{pass.input}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] uppercase font-semibold shrink-0 w-14" style={{ color: pass.color }}>Output</span>
              <span className="text-xs" style={{ color: COLORS.text }}>{pass.output}</span>
            </div>
            <div className="flex gap-4 mt-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: pass.colorDim, color: pass.color }}>
                {pass.tokens}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: COLORS.accent }}>
                {pass.model}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ SECTION DATA ═══════════════════ */

/* ── 1. System Overview ── */
const OVERVIEW_NODES: NodeData[] = [
  { id: 'user', label: 'User / Browser', x: 395, y: 20, w: 130, h: 60, color: COLORS.green, colorDim: COLORS.greenDim, icon: '👤', desc: 'End users (founders, PMs, engineers) accessing CodeVision via web browser. They submit GitHub URLs and requirement documents for analysis.', group: 'client' },
  { id: 'nextjs', label: 'Next.js Frontend', x: 360, y: 120, w: 200, h: 60, color: COLORS.blue, colorDim: COLORS.blueDim, icon: '🖥️', desc: 'React-based UI with 6 interactive visualization tabs: Architecture Map, Modules, User Flow, Tech Stack, Version Diff, and Risks. Features founder/dev mode toggle and animated graph diagrams.', group: 'client' },
  { id: 'api', label: 'API Routes Layer', x: 360, y: 230, w: 200, h: 60, color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '🔌', desc: 'Next.js API routes handling 28+ endpoints across auth, projects, analysis, chat, export, and plugin domains. Includes SSE streaming for real-time progress.', group: 'server' },
  { id: 'auth', label: 'Auth Service', x: 60, y: 230, w: 120, h: 55, color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔐', desc: 'JWT-based authentication with HTTP-only cookies. Email domain validation, OTP verification, and bcrypt password hashing.', group: 'server' },
  { id: 'jobmgr', label: 'Job Manager', x: 740, y: 230, w: 120, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '📋', desc: 'Async job orchestration with EventEmitter-based progress streaming. Manages job lifecycle: queued → running → completed/failed.', group: 'server' },
  { id: 'analyzer', label: 'Analyzer (Orchestrator)', x: 360, y: 340, w: 200, h: 60, color: COLORS.accent, colorDim: COLORS.accentDim, icon: '🎯', desc: 'Main orchestrator coordinating the full pipeline: repo ingestion → file manifest → structural parsing → multi-pass AI analysis → business lens generation → results storage.', group: 'core' },
  { id: 'github_svc', label: 'GitHub Service', x: 60, y: 340, w: 120, h: 55, color: COLORS.green, colorDim: COLORS.greenDim, icon: '🐙', desc: 'Repository acquisition via tarball download or git clone. Fetches metadata: stars, languages, contributors, commit history from GitHub REST API.', group: 'core' },
  { id: 'parser', label: 'Parser Service', x: 60, y: 445, w: 120, h: 55, color: COLORS.yellow, colorDim: COLORS.yellowDim, icon: '🌳', desc: 'Tree-sitter AST parsing for Python, JS, TS, Go, Java. Builds dependency graphs, detects architecture patterns (MVC, MVVM, Clean Architecture, microservices).', group: 'core' },
  { id: 'chunker', label: 'Chunker Service', x: 220, y: 445, w: 120, h: 55, color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '📂', desc: 'File manifest builder with intelligent prioritization. Scores files (0-1) by category, imports, and size. Selects top 400 relevant files for analysis.', group: 'core' },
  { id: 'analysis', label: 'Analysis Engine', x: 380, y: 445, w: 155, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🧠', desc: 'Multi-pass Claude AI analysis: Pass 1 (Module Summaries) → Pass 2 (Architecture Graph) → Pass 3 (Business Context) → Pass 4 (Founder Narrative). Max 80K input tokens per pass.', group: 'core' },
  { id: 'risk', label: 'Risk Engine', x: 575, y: 445, w: 120, h: 55, color: COLORS.red, colorDim: COLORS.redDim, icon: '⚠️', desc: 'Detects 44 technologies, generates risk assessments from AI findings + static checks. Computes complexity score (1-10) and remediation estimates ($900/day).', group: 'core' },
  { id: 'lenses', label: 'Business Lenses', x: 740, y: 445, w: 120, h: 55, color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔍', desc: 'Maps architecture to business capabilities (8 capabilities across 3 domains). Generates user journey graphs, quality reports, and confidence scores.', group: 'core' },
  { id: 'chat', label: 'Chat Service', x: 740, y: 340, w: 120, h: 55, color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '💬', desc: 'Context-aware Q&A with founder/dev modes. Searches repo for relevant code, selects modules by keyword. Supports 8-message history context window.', group: 'core' },
  { id: 'claude_api', label: 'Claude API', x: 310, y: 570, w: 130, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🤖', desc: 'Anthropic Claude Sonnet model for multi-pass analysis, chat Q&A, and code understanding. Rate limit retry with exponential backoff (max 3 retries).', group: 'external' },
  { id: 'github_api', label: 'GitHub API', x: 60, y: 570, w: 130, h: 55, color: COLORS.green, colorDim: COLORS.greenDim, icon: '🐙', desc: 'GitHub REST API v3 for repository cloning, metadata fetching (stars, languages, contributors), tarball download, and README access.', group: 'external' },
  { id: 'supabase', label: 'Supabase', x: 565, y: 570, w: 130, h: 55, color: COLORS.blue, colorDim: COLORS.blueDim, icon: '🗄️', desc: 'PostgreSQL database (users, projects, analyses, documents, feedback) + file storage for uploaded requirement documents (PDFs, images, markdown).', group: 'external' },
  { id: 'resend', label: 'Resend Email', x: 770, y: 570, w: 120, h: 55, color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '📧', desc: 'Email delivery for OTP verification codes and feedback notifications to admin team.', group: 'external' },
];

const OVERVIEW_EDGES: EdgeData[] = [
  { from: 'user', to: 'nextjs', label: 'interacts', color: COLORS.green },
  { from: 'nextjs', to: 'api', label: 'REST / SSE', color: COLORS.blue },
  { from: 'api', to: 'auth', label: 'JWT verify', color: COLORS.cyan },
  { from: 'api', to: 'analyzer', label: 'triggers', color: COLORS.accent },
  { from: 'api', to: 'jobmgr', label: 'job ops', color: COLORS.orange },
  { from: 'api', to: 'chat', label: 'Q&A', color: COLORS.pink },
  { from: 'analyzer', to: 'github_svc', label: 'clone repo', color: COLORS.green },
  { from: 'analyzer', to: 'chunker', label: 'build manifest', color: COLORS.pink },
  { from: 'analyzer', to: 'parser', label: 'parse AST', color: COLORS.yellow },
  { from: 'analyzer', to: 'analysis', label: 'multi-pass', color: COLORS.orange },
  { from: 'analyzer', to: 'risk', label: 'assess risk', color: COLORS.red },
  { from: 'analyzer', to: 'lenses', label: 'build lenses', color: COLORS.cyan },
  { from: 'analysis', to: 'claude_api', label: 'LLM calls', color: COLORS.orange, animated: true },
  { from: 'chat', to: 'claude_api', label: 'Q&A calls', color: COLORS.orange, animated: true },
  { from: 'github_svc', to: 'github_api', label: 'REST', color: COLORS.green, animated: true },
  { from: 'analyzer', to: 'supabase', label: 'store results', color: COLORS.blue },
  { from: 'auth', to: 'supabase', label: 'user data', color: COLORS.cyan, dashed: true },
  { from: 'auth', to: 'resend', label: 'OTP email', color: COLORS.purple, dashed: true },
  { from: 'jobmgr', to: 'analyzer', label: 'dispatch', color: COLORS.orange },
];

const OVERVIEW_GROUPS = [
  { label: 'Client Layer', x: 330, y: 8, w: 260, h: 185, color: 'rgba(52,211,153,0.06)' },
  { label: 'Server / API Layer', x: 30, y: 215, w: 860, h: 90, color: 'rgba(167,139,250,0.06)' },
  { label: 'Core Analysis Engine', x: 30, y: 320, w: 860, h: 200, color: 'rgba(129,140,248,0.06)' },
  { label: 'External Services', x: 30, y: 555, w: 880, h: 85, color: 'rgba(251,146,60,0.06)' },
];

/* ── 2. Pipeline Steps ── */
const PIPELINE_STEPS = [
  { title: 'Repository Acquisition', icon: '🐙', color: COLORS.green, colorDim: COLORS.greenDim, desc: 'Clone or download GitHub repository and fetch metadata (stars, languages, contributors).', detail: 'Attempts tarball download first (serverless-compatible), falls back to git shallow clone. Collects 10+ metadata signals from GitHub REST API in parallel.', tools: ['GitHub API', 'simple-git', 'tar'] },
  { title: 'File Manifest & Prioritization', icon: '📂', color: COLORS.pink, colorDim: COLORS.pinkDim, desc: 'Walk directory tree, categorize files, and score by relevance.', detail: 'Supports 16+ languages. Categorizes files as entry_point (score=5), config (4), route (3), model (3), service, utility, or test. Extracts import/export relationships. Selects top 400 non-test files.', tools: ['chunker-service', 'fs walkdir'] },
  { title: 'Structural Code Analysis', icon: '🌳', color: COLORS.yellow, colorDim: COLORS.yellowDim, desc: 'Parse source code into ASTs and build dependency graphs.', detail: 'Uses Tree-sitter for Python, JS, TS, Go, Java (regex fallback for others). Extracts classes, functions, imports, exports. Resolves import targets to build directed dependency graph. Detects patterns: MVC, MVVM, Clean Architecture, microservices.', tools: ['Tree-sitter', 'parser-service', 'ast-grep'] },
  { title: 'Document Parsing', icon: '📄', color: COLORS.purple, colorDim: COLORS.purpleDim, desc: 'Parse uploaded requirement documents (PDFs, images, markdown) from storage.', detail: 'Downloads documents from Supabase storage. Uses pdf-parse for PDFs, UTF-8 decoding for text/markdown, and Base64 encoding for images.', tools: ['pdf-parse', 'Supabase Storage'] },
  { title: 'Multi-Pass AI Analysis', icon: '🧠', color: COLORS.orange, colorDim: COLORS.orangeDim, desc: 'Progressive Claude AI analysis in 4 passes with structured JSON output.', detail: 'Pass 1: Module business summaries. Pass 2: Architecture graph (5-12 nodes). Pass 3: Business context (journeys, value features). Pass 4: Founder narrative. Max 80K tokens/pass with retry logic.', tools: ['Claude API', 'analysis-service'] },
  { title: 'Technology & Risk Assessment', icon: '⚠️', color: COLORS.red, colorDim: COLORS.redDim, desc: 'Detect technology stack and generate risk inventory with remediation estimates.', detail: 'Pattern-matches 44 technologies. Static checks: test coverage, CI/CD, containerization, env templates, module size, bus factor, security signals. Combines with AI findings. Estimates remediation at $900/day.', tools: ['tech-risk-engine'] },
  { title: 'Business Lens Generation', icon: '🔍', color: COLORS.cyan, colorDim: COLORS.cyanDim, desc: 'Map architecture to business capabilities and user journeys.', detail: 'Creates capability graph: 3 strategic domains → 8 business capabilities → system components. Generates user journey graphs with friction overlays. Builds quality report with confidence scores and coverage metrics.', tools: ['lenses service'] },
  { title: 'View Compilation & Storage', icon: '💾', color: COLORS.blue, colorDim: COLORS.blueDim, desc: 'Transform analysis into UI-ready views and persist to database.', detail: 'Builds: diagram view (nodes/edges with domain colors), business flows, tech stack dashboard, risk panel. Stores all outputs in Supabase with git metadata (branch, commit hash). Updates project status to completed.', tools: ['analysis-views', 'Supabase'] },
];

/* ── 3. AI Engine Passes ── */
const AI_PASSES = [
  { num: 1, title: 'Module Summaries', icon: '📦', color: COLORS.green, colorDim: COLORS.greenDim, input: 'Top 15 modules by dependency degree + their source files + key technologies', output: 'Per-module: display_name, business_function, key_technologies, estimated_loc', tokens: '~80K input', model: 'Claude Sonnet', detail: 'Analyzes each module\'s purpose in plain business language. Groups files by logical function and identifies the technologies powering each module.' },
  { num: 2, title: 'Architecture Graph', icon: '🏗️', color: COLORS.blue, colorDim: COLORS.blueDim, input: 'Module summaries + dependency graph edges + file manifest metadata', output: '5-12 business-friendly nodes, typed edges, 3-6 data flow steps', tokens: '~80K input', model: 'Claude Sonnet', detail: 'Produces a human-readable architecture map with nodes named for business functions (not file paths). Edges show data flow direction and type (imports, calls, stores, renders).' },
  { num: 3, title: 'Business Context', icon: '💼', color: COLORS.purple, colorDim: COLORS.purpleDim, input: 'Architecture graph + requirements documents + gap findings', output: 'User journeys, value features, data usage patterns, external dependencies', tokens: '~80K input', model: 'Claude Sonnet', detail: 'Maps technical architecture to business outcomes. Identifies key user journeys (4-6 steps each), value-driving features, and how data flows create or destroy business value.' },
  { num: 4, title: 'Founder Narrative', icon: '🚀', color: COLORS.orange, colorDim: COLORS.orangeDim, input: 'All prior pass outputs + complete analysis context', output: 'Founder-friendly narrative, technical narrative, strategic insights', tokens: '~80K input', model: 'Claude Sonnet', detail: 'Translates everything into a compelling narrative for non-technical stakeholders. Uses analogies and plain English. Generates strategic recommendations and competitive positioning insights.' },
];

/* ── 4. Frontend Architecture ── */
const FRONTEND_NODES: NodeData[] = [
  { id: 'home', label: 'Home / Dashboard', x: 370, y: 20, w: 140, h: 55, color: COLORS.green, colorDim: COLORS.greenDim, icon: '🏠', desc: 'Landing page with RepoUrlHero component. Shows project grid for authenticated users with status badges and quick actions.' },
  { id: 'wizard', label: 'Project Wizard', x: 140, y: 20, w: 130, h: 55, color: COLORS.blue, colorDim: COLORS.blueDim, icon: '🧙', desc: '3-step creation flow: Project Details → GitHub Connection → Requirements Upload. Uses WizardContext for cross-step state.' },
  { id: 'project', label: 'Project Detail', x: 280, y: 120, w: 150, h: 55, color: COLORS.accent, colorDim: COLORS.accentDim, icon: '📊', desc: 'Main analysis dashboard with 6 tabs, sidebar, floating chat button, export menu, and real-time progress tracking via SSE.' },
  { id: 'arch_tab', label: 'Architecture Map', x: 40, y: 230, w: 130, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🗺️', desc: 'Force-directed SVG graph with physics simulation. Domain coloring, zoom (0.45-1.3x), fullscreen, animated particle flow, scenario playback.' },
  { id: 'modules_tab', label: 'Modules View', x: 190, y: 230, w: 120, h: 55, color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '📦', desc: 'Grid of type-colored module cards. Click to see files, incoming/outgoing connections. Cross-highlights with architecture diagram.' },
  { id: 'flow_tab', label: 'User Flow', x: 330, y: 230, w: 110, h: 55, color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔄', desc: 'Vertical data flow visualization. Shows stages: Frontend → API → Business Logic → Data Storage → External Services with module assignments.' },
  { id: 'tech_tab', label: 'Tech Stack', x: 460, y: 230, w: 110, h: 55, color: COLORS.yellow, colorDim: COLORS.yellowDim, icon: '⚙️', desc: 'Dashboard with complexity gauge, language donut chart, framework/infra/services chips, technology choices cards, and data architecture table.' },
  { id: 'diff_tab', label: 'Version Diff', x: 590, y: 230, w: 110, h: 55, color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '🔀', desc: 'Compares two analysis versions. Shows delta architecture map with added/removed/modified nodes. Includes journey, risk, and tech change summaries.' },
  { id: 'risk_tab', label: 'Risk Panel', x: 720, y: 230, w: 110, h: 55, color: COLORS.red, colorDim: COLORS.redDim, icon: '⚠️', desc: 'Risk inventory grouped by severity. Each risk shows category, source, impact, evidence, and remediation estimate. Supports founder-mode simplification.' },
  { id: 'diagram_views', label: 'Diagram Views', x: 40, y: 340, w: 130, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🔲', desc: '4 visualization modes: Graph (force-directed), Metro Map (subway-style), Story (narrative), Live (animated demo). Switchable via ViewSwitcher.' },
  { id: 'chat_panel', label: 'Chat Panel', x: 590, y: 120, w: 120, h: 55, color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '💬', desc: 'Slide-in Q&A panel with founder/dev mode toggle. Shows starter questions, follow-up suggestions, and module highlight buttons.' },
  { id: 'export', label: 'Export (PDF/Slides)', x: 740, y: 120, w: 130, h: 55, color: COLORS.blue, colorDim: COLORS.blueDim, icon: '📤', desc: 'Export analysis as PDF report or Markdown slides. PDF includes executive summary, architecture, tech stack, flows, risk sections.' },
];

const FRONTEND_EDGES: EdgeData[] = [
  { from: 'home', to: 'project', label: 'navigate', color: COLORS.green },
  { from: 'home', to: 'wizard', label: 'create new', color: COLORS.blue },
  { from: 'wizard', to: 'project', label: 'after creation', color: COLORS.blue },
  { from: 'project', to: 'arch_tab', color: COLORS.accent },
  { from: 'project', to: 'modules_tab', color: COLORS.accent },
  { from: 'project', to: 'flow_tab', color: COLORS.accent },
  { from: 'project', to: 'tech_tab', color: COLORS.accent },
  { from: 'project', to: 'diff_tab', color: COLORS.accent },
  { from: 'project', to: 'risk_tab', color: COLORS.accent },
  { from: 'project', to: 'chat_panel', label: 'toggle', color: COLORS.pink },
  { from: 'project', to: 'export', label: 'export', color: COLORS.blue },
  { from: 'arch_tab', to: 'diagram_views', label: 'switch view', color: COLORS.orange },
];

/* ── 5. API Layer ── */
const API_NODES: NodeData[] = [
  { id: 'auth_api', label: 'Auth APIs', x: 60, y: 30, w: 130, h: 55, color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔐', desc: 'POST /auth/signup, /auth/login, /auth/verify-email, /auth/logout, /auth/resend-otp, GET /auth/me. JWT tokens + HTTP-only cookies.' },
  { id: 'project_api', label: 'Project APIs', x: 230, y: 30, w: 130, h: 55, color: COLORS.green, colorDim: COLORS.greenDim, icon: '📁', desc: 'POST /projects (create + auto-analyze), GET /projects (list), GET/DELETE /projects/[id]. Ownership validation on all ops.' },
  { id: 'repo_api', label: 'Repo Analysis APIs', x: 400, y: 30, w: 145, h: 55, color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🔬', desc: 'POST /repo/analyze (async job), GET /repo/[id]/status, /events (SSE stream), /result. Real-time progress with 15s heartbeat.' },
  { id: 'analysis_api', label: 'Analysis View APIs', x: 590, y: 30, w: 145, h: 55, color: COLORS.accent, colorDim: COLORS.accentDim, icon: '📊', desc: 'GET /analysis/[id], /diagram, /techstack, /risks, /capabilities, /journeys, /flows, /diff. Each builds specific UI-ready views.' },
  { id: 'chat_api', label: 'Chat / QA APIs', x: 780, y: 30, w: 120, h: 55, color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '💬', desc: 'POST /chat (project-level), POST /qa/[id]/ask (analysis-level with founderMode). GET /qa/[id]/history. Max 2000 char messages.' },
  { id: 'github_api_r', label: 'GitHub APIs', x: 60, y: 140, w: 130, h: 55, color: COLORS.green, colorDim: COLORS.greenDim, icon: '🐙', desc: 'POST /github/validate (test token access), POST /github/readme (fetch + base64 decode README). Used during project creation wizard.' },
  { id: 'doc_api', label: 'Document APIs', x: 230, y: 140, w: 130, h: 55, color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '📄', desc: 'POST /documents (upload to Supabase, max 10MB), GET /documents?project_id=X, DELETE /documents/[id]. Supports PDF, MD, TXT, images.' },
  { id: 'export_api', label: 'Export APIs', x: 400, y: 140, w: 130, h: 55, color: COLORS.blue, colorDim: COLORS.blueDim, icon: '📤', desc: 'POST /export/[id]/pdf (binary PDF download), POST /export/[id]/slides (markdown slides). Includes exec summary, architecture, risks.' },
  { id: 'lens_api', label: 'Lens APIs', x: 570, y: 140, w: 130, h: 55, color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔍', desc: 'GET /analysis/lenses/[id]/node/[nodeId] (drill-down with depth 1-2). Returns children, linked journeys, quality metrics.' },
  { id: 'feedback_api', label: 'Feedback API', x: 740, y: 140, w: 130, h: 55, color: COLORS.yellow, colorDim: COLORS.yellowDim, icon: '📝', desc: 'POST /feedback with category (bug/feature/general), message, browser info, console logs. Stores in DB + emails admin notification.' },
  { id: 'plugin_api', label: 'Plugin APIs', x: 400, y: 250, w: 130, h: 55, color: COLORS.red, colorDim: COLORS.redDim, icon: '🔌', desc: 'CORS-enabled endpoints for Chrome extension: POST /plugin/chat (element-context Q&A), GET /plugin/workspaces, POST /plugin/analysis/[id]/element.' },
];

const API_EDGES: EdgeData[] = [
  { from: 'auth_api', to: 'project_api', label: 'auth guard', color: COLORS.cyan, dashed: true },
  { from: 'project_api', to: 'repo_api', label: 'triggers', color: COLORS.green },
  { from: 'repo_api', to: 'analysis_api', label: 'produces', color: COLORS.orange },
  { from: 'analysis_api', to: 'chat_api', label: 'context', color: COLORS.accent },
  { from: 'analysis_api', to: 'export_api', label: 'source data', color: COLORS.accent },
  { from: 'analysis_api', to: 'lens_api', label: 'drill-down', color: COLORS.cyan },
  { from: 'github_api_r', to: 'project_api', label: 'validation', color: COLORS.green, dashed: true },
  { from: 'doc_api', to: 'project_api', label: 'requirements', color: COLORS.purple, dashed: true },
];

/* ── 6. Tech Stack ── */
interface TechItem {
  name: string;
  category: string;
  color: string;
  colorDim: string;
  icon: string;
  role: string;
}

const TECH_STACK: TechItem[] = [
  { name: 'Next.js 16', category: 'Framework', color: COLORS.blue, colorDim: COLORS.blueDim, icon: '▲', role: 'Full-stack React framework (SSR, API routes, file routing)' },
  { name: 'React 19', category: 'Frontend', color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '⚛', role: 'UI rendering with hooks, context, and memoization' },
  { name: 'TypeScript 5', category: 'Language', color: COLORS.blue, colorDim: COLORS.blueDim, icon: '🔷', role: 'Type-safe development across frontend and backend' },
  { name: 'Tailwind CSS 4', category: 'Styling', color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🎨', role: 'Utility-first CSS with custom dark theme system' },
  { name: 'Claude Sonnet', category: 'AI', color: COLORS.orange, colorDim: COLORS.orangeDim, icon: '🤖', role: 'Multi-pass code analysis, Q&A chat, business narratives' },
  { name: 'Tree-sitter', category: 'Parsing', color: COLORS.yellow, colorDim: COLORS.yellowDim, icon: '🌳', role: 'AST parsing for Python, JS, TS, Go, Java code analysis' },
  { name: 'ast-grep', category: 'Parsing', color: COLORS.yellow, colorDim: COLORS.yellowDim, icon: '🔍', role: 'Structural code search and pattern matching' },
  { name: 'Supabase', category: 'Database', color: COLORS.green, colorDim: COLORS.greenDim, icon: '🗄️', role: 'PostgreSQL DB + file storage for documents and analysis' },
  { name: 'Zod', category: 'Validation', color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '✅', role: 'Runtime schema validation on all API inputs' },
  { name: 'JWT', category: 'Auth', color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔐', role: '7-day tokens with HTTP-only secure cookies' },
  { name: 'bcrypt', category: 'Auth', color: COLORS.cyan, colorDim: COLORS.cyanDim, icon: '🔒', role: 'Password hashing with salt rounds' },
  { name: 'Resend', category: 'Email', color: COLORS.purple, colorDim: COLORS.purpleDim, icon: '📧', role: 'OTP verification and feedback notifications' },
  { name: 'pdf-parse', category: 'Document', color: COLORS.pink, colorDim: COLORS.pinkDim, icon: '📄', role: 'PDF text extraction for requirement documents' },
  { name: 'simple-git', category: 'Git', color: COLORS.green, colorDim: COLORS.greenDim, icon: '🔀', role: 'Repository cloning and git metadata extraction' },
  { name: 'Vitest', category: 'Testing', color: COLORS.green, colorDim: COLORS.greenDim, icon: '🧪', role: 'Unit testing framework with jsdom environment' },
  { name: 'Playwright', category: 'Testing', color: COLORS.green, colorDim: COLORS.greenDim, icon: '🎭', role: 'End-to-end browser testing' },
];

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */
export default function SystemDesignPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activePipelineStep, setActivePipelineStep] = useState(0);
  const [activePass, setActivePass] = useState<number | null>(null);
  const [techFilter, setTechFilter] = useState<string | null>(null);

  const scrollToSection = useCallback((section: Section) => {
    setActiveSection(section);
    setSelectedNode(null);
  }, []);

  const categories = [...new Set(TECH_STACK.map(t => t.category))];
  const filteredTech = techFilter ? TECH_STACK.filter(t => t.category === techFilter) : TECH_STACK;

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto pt-8 pb-4 px-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: COLORS.accentDim, border: `1px solid ${COLORS.accent}` }}>
            🏗️
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: COLORS.text }}>System Architecture</h1>
            <p className="text-sm" style={{ color: COLORS.textDim }}>CodeVision &mdash; AI-Powered Codebase Intelligence Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky top-0 z-50 backdrop-blur-xl" style={{ background: 'rgba(10, 14, 26, 0.85)', borderBottom: `1px solid ${COLORS.border}` }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
                style={{
                  background: activeSection === s.id ? COLORS.accentDim : 'transparent',
                  color: activeSection === s.id ? COLORS.accent : COLORS.textDim,
                  border: `1px solid ${activeSection === s.id ? COLORS.accent + '40' : 'transparent'}`,
                }}
                onClick={() => scrollToSection(s.id)}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ═══ 1. System Overview ═══ */}
        {activeSection === 'overview' && (
          <section>
            <div className="mb-6">
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                CodeVision is an AI-powered codebase intelligence platform that transforms GitHub repositories into interactive,
                business-friendly architecture visualizations. Users submit a repo URL, and the system performs multi-pass analysis
                using Claude AI, Tree-sitter AST parsing, and deterministic code signals to produce architecture diagrams, capability
                maps, risk assessments, and executive narratives.
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'API Endpoints', value: '28+', color: COLORS.purple },
                { label: 'Analysis Passes', value: '4', color: COLORS.orange },
                { label: 'Tech Detection', value: '44', color: COLORS.yellow },
                { label: 'Visualization Views', value: '6', color: COLORS.blue },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-xl p-4 text-center"
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                >
                  <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs" style={{ color: COLORS.textDim }}>{s.label}</p>
                </div>
              ))}
            </div>

            <InteractiveGraph
              nodes={OVERVIEW_NODES}
              edges={OVERVIEW_EDGES}
              width={920}
              height={650}
              selected={selectedNode}
              onSelect={setSelectedNode}
              title="End-to-End System Architecture"
              subtitle="Click any component to explore its role and connections"
              groupLabels={OVERVIEW_GROUPS}
            />
          </section>
        )}

        {/* ═══ 2. Data Pipeline ═══ */}
        {activeSection === 'pipeline' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Data Processing Pipeline</h2>
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                When a user submits a GitHub repository URL, CodeVision executes an 8-stage pipeline that progressively transforms
                raw source code into business-ready architecture insights. Each stage builds upon the previous, combining deterministic
                code signals with AI-generated understanding.
              </p>
            </div>

            {/* progress bar */}
            <div className="mb-8 rounded-xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: COLORS.textDim }}>Pipeline Progress</span>
                <span className="text-xs font-mono" style={{ color: COLORS.accent }}>
                  {Math.round(((activePipelineStep + 1) / PIPELINE_STEPS.length) * 100)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${((activePipelineStep + 1) / PIPELINE_STEPS.length) * 100}%`,
                    background: `linear-gradient(90deg, ${COLORS.green}, ${COLORS.blue}, ${COLORS.purple}, ${COLORS.orange})`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                {PIPELINE_STEPS.map((s, i) => (
                  <button
                    key={i}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all"
                    style={{
                      background: i <= activePipelineStep ? s.colorDim : 'transparent',
                      border: `1px solid ${i <= activePipelineStep ? s.color : COLORS.border}`,
                      color: s.color,
                    }}
                    onClick={() => setActivePipelineStep(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* pipeline steps */}
            <div className="max-w-2xl mx-auto">
              {PIPELINE_STEPS.map((step, i) => (
                <PipelineStep
                  key={i}
                  step={step}
                  index={i}
                  total={PIPELINE_STEPS.length}
                  isActive={activePipelineStep === i}
                  onClick={() => setActivePipelineStep(i)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ═══ 3. AI Analysis Engine ═══ */}
        {activeSection === 'ai-engine' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>AI Multi-Pass Analysis Engine</h2>
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                The core intelligence of CodeVision uses a progressive 4-pass architecture with Claude Sonnet. Each pass
                builds on the previous, progressively refining understanding from raw code structure into business-ready insights.
                This approach handles the token limit constraint (80K tokens per pass) while maintaining context coherence across passes.
              </p>
            </div>

            {/* flow diagram */}
            <div className="mb-8 rounded-xl p-6 overflow-x-auto" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <div className="flex items-center gap-3 min-w-[700px] justify-center">
                {AI_PASSES.map((pass, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="w-28 h-28 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                      style={{
                        background: activePass === i ? pass.colorDim : 'transparent',
                        border: `2px solid ${activePass === i ? pass.color : COLORS.border}`,
                        boxShadow: activePass === i ? `0 0 30px ${pass.colorDim}` : 'none',
                      }}
                      onClick={() => setActivePass(activePass === i ? null : i)}
                    >
                      <span className="text-2xl mb-1">{pass.icon}</span>
                      <p className="text-[10px] font-semibold" style={{ color: pass.color }}>PASS {pass.num}</p>
                      <p className="text-[9px] text-center px-1" style={{ color: COLORS.textDim }}>{pass.title}</p>
                    </div>
                    {i < AI_PASSES.length - 1 && (
                      <div className="flex items-center gap-1">
                        <div className="w-8 h-0.5" style={{ background: `linear-gradient(90deg, ${pass.color}, ${AI_PASSES[i + 1].color})` }} />
                        <span style={{ color: AI_PASSES[i + 1].color }}>▸</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center mt-4 gap-6">
                {[
                  { label: 'Input Limit', value: '80K tokens/pass', color: COLORS.accent },
                  { label: 'Output Reserve', value: '8K tokens', color: COLORS.green },
                  { label: 'Model', value: 'Claude Sonnet', color: COLORS.orange },
                  { label: 'Retry Policy', value: '3x exponential', color: COLORS.yellow },
                ].map(m => (
                  <span key={m.label} className="text-[10px] px-3 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.08)', color: m.color, border: `1px solid ${m.color}30` }}>
                    {m.label}: {m.value}
                  </span>
                ))}
              </div>
            </div>

            {/* pass detail cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AI_PASSES.map((pass, i) => (
                <AIPassCard
                  key={i}
                  pass={pass}
                  isActive={activePass === i}
                  onClick={() => setActivePass(activePass === i ? null : i)}
                />
              ))}
            </div>

            {/* Fallback note */}
            <div className="mt-6 rounded-xl p-4" style={{ background: COLORS.yellowDim, border: `1px solid ${COLORS.yellow}30` }}>
              <div className="flex items-start gap-3">
                <span className="text-xl">⚡</span>
                <div>
                  <h4 className="text-sm font-semibold mb-1" style={{ color: COLORS.yellow }}>Fallback Strategy</h4>
                  <p className="text-xs leading-relaxed" style={{ color: COLORS.textDim }}>
                    If the multi-pass pipeline fails (API errors, rate limits, malformed output), the system automatically falls back
                    to a single-pass analysis using <code className="px-1 rounded" style={{ background: 'rgba(251,191,36,0.1)' }}>analyzeCodeAlignment()</code> that
                    compares code against requirements documents in one call. This ensures users always get results, even if at lower fidelity.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ 4. Frontend Architecture ═══ */}
        {activeSection === 'frontend' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Frontend Component Architecture</h2>
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                The UI is built with React 19 and Next.js 16, featuring a dark glass-morphism theme with SVG-based interactive diagrams.
                The project detail page serves as the main dashboard with 6 switchable visualization tabs, a floating chat panel, and real-time
                analysis progress tracking via Server-Sent Events.
              </p>
            </div>

            <InteractiveGraph
              nodes={FRONTEND_NODES}
              edges={FRONTEND_EDGES}
              width={900}
              height={420}
              selected={selectedNode}
              onSelect={setSelectedNode}
              title="Component & Page Structure"
              subtitle="Click any component to see details about its role and features"
              groupLabels={[
                { label: 'Pages', x: 100, y: 8, w: 520, h: 80, color: 'rgba(52,211,153,0.06)' },
                { label: 'Visualization Tabs', x: 20, y: 215, w: 830, h: 80, color: 'rgba(129,140,248,0.06)' },
              ]}
            />

            {/* persona cards */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>Supported Personas</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { persona: 'Founder', icon: '🚀', color: COLORS.orange, colorDim: COLORS.orangeDim, desc: 'Plain-English narratives, business analogies, strategic insights. Hides technical jargon.' },
                  { persona: 'Product Manager', icon: '📋', color: COLORS.purple, colorDim: COLORS.purpleDim, desc: 'Capability maps, user journeys, risk impact assessments. Focuses on business value.' },
                  { persona: 'Engineer', icon: '👩‍💻', color: COLORS.blue, colorDim: COLORS.blueDim, desc: 'Full architecture diagrams, dependency graphs, tech stack details, code-level connections.' },
                  { persona: 'Demo Mode', icon: '🎬', color: COLORS.pink, colorDim: COLORS.pinkDim, desc: 'Animated walkthroughs, scenario playback, live system visualization with data flow particles.' },
                ].map(p => (
                  <div
                    key={p.persona}
                    className="rounded-xl p-4"
                    style={{ background: p.colorDim, border: `1px solid ${p.color}30` }}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <h4 className="text-sm font-bold mt-2" style={{ color: p.color }}>{p.persona}</h4>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: COLORS.textDim }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ═══ 5. API Layer ═══ */}
        {activeSection === 'api' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>API Layer Architecture</h2>
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                The server exposes 28+ REST API endpoints organized across 11 functional domains. All routes use Zod schema validation,
                JWT authentication (except public endpoints), and consistent error handling. The analysis pipeline uses Server-Sent Events
                for real-time progress streaming.
              </p>
            </div>

            <InteractiveGraph
              nodes={API_NODES}
              edges={API_EDGES}
              width={950}
              height={330}
              selected={selectedNode}
              onSelect={setSelectedNode}
              title="API Route Groups"
              subtitle="Click any group to see its endpoints and responsibilities"
            />

            {/* endpoint summary table */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>Endpoint Summary</h3>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.border}` }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'rgba(99,102,241,0.08)' }}>
                      {['Domain', 'Endpoints', 'Methods', 'Auth', 'Key Feature'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: COLORS.textDim, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { domain: 'Auth', endpoints: 6, methods: 'POST, GET', auth: 'Public', feature: 'JWT + OTP email verification' },
                      { domain: 'Projects', endpoints: 3, methods: 'POST, GET, DELETE', auth: 'Required', feature: 'Auto-triggers analysis on create' },
                      { domain: 'Repo Analysis', endpoints: 4, methods: 'POST, GET', auth: 'Required', feature: 'SSE real-time progress stream' },
                      { domain: 'Analysis Views', endpoints: 8, methods: 'GET', auth: 'Required', feature: 'UI-ready view builders' },
                      { domain: 'Chat / Q&A', endpoints: 3, methods: 'POST, GET', auth: 'Required', feature: 'Founder/dev mode toggle' },
                      { domain: 'Documents', endpoints: 3, methods: 'POST, GET, DELETE', auth: 'Required', feature: '10MB max, 7 file types' },
                      { domain: 'Export', endpoints: 2, methods: 'POST', auth: 'Required', feature: 'PDF + Markdown slides' },
                      { domain: 'Plugin', endpoints: 3, methods: 'POST, GET', auth: 'Required', feature: 'CORS-enabled for Chrome ext' },
                    ].map(r => (
                      <tr key={r.domain} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td className="px-4 py-2 font-medium" style={{ color: COLORS.text }}>{r.domain}</td>
                        <td className="px-4 py-2 font-mono" style={{ color: COLORS.accent }}>{r.endpoints}</td>
                        <td className="px-4 py-2" style={{ color: COLORS.textDim }}>{r.methods}</td>
                        <td className="px-4 py-2" style={{ color: r.auth === 'Public' ? COLORS.green : COLORS.yellow }}>{r.auth}</td>
                        <td className="px-4 py-2" style={{ color: COLORS.textDim }}>{r.feature}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══ 6. Technology Stack ═══ */}
        {activeSection === 'tech' && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2" style={{ color: COLORS.text }}>Technology Stack</h2>
              <p className="text-sm leading-relaxed max-w-3xl" style={{ color: COLORS.textDim }}>
                CodeVision is built as a full-stack TypeScript application using Next.js 16, with Claude Sonnet as the core AI engine,
                Tree-sitter for structural code analysis, and Supabase for data persistence.
              </p>
            </div>

            {/* category filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: !techFilter ? COLORS.accentDim : 'transparent',
                  color: !techFilter ? COLORS.accent : COLORS.textDim,
                  border: `1px solid ${!techFilter ? COLORS.accent + '40' : COLORS.border}`,
                }}
                onClick={() => setTechFilter(null)}
              >
                All ({TECH_STACK.length})
              </button>
              {categories.map(c => {
                const count = TECH_STACK.filter(t => t.category === c).length;
                return (
                  <button
                    key={c}
                    className="text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: techFilter === c ? COLORS.accentDim : 'transparent',
                      color: techFilter === c ? COLORS.accent : COLORS.textDim,
                      border: `1px solid ${techFilter === c ? COLORS.accent + '40' : COLORS.border}`,
                    }}
                    onClick={() => setTechFilter(techFilter === c ? null : c)}
                  >
                    {c} ({count})
                  </button>
                );
              })}
            </div>

            {/* tech grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTech.map(tech => (
                <div
                  key={tech.name}
                  className="rounded-xl p-4 transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                      style={{ background: tech.colorDim, border: `1px solid ${tech.color}30` }}
                    >
                      {tech.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold" style={{ color: COLORS.text }}>{tech.name}</h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tech.colorDim, color: tech.color }}>{tech.category}</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: COLORS.textDim }}>{tech.role}</p>
                </div>
              ))}
            </div>

            {/* architecture pattern */}
            <div className="mt-8 rounded-xl p-6" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.text }}>Architecture Patterns Used</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { pattern: 'Multi-Pass AI Pipeline', desc: 'Progressive refinement across 4 passes, each building on previous output. Handles token limits while maintaining context coherence.', color: COLORS.orange },
                  { pattern: 'Deterministic + AI Hybrid', desc: 'Combines Tree-sitter AST analysis, file heuristics, and pattern detection with LLM-generated business understanding.', color: COLORS.green },
                  { pattern: 'Event-Driven Job System', desc: 'Long-running analysis managed via EventEmitter with SSE streaming for real-time progress updates to the client.', color: COLORS.blue },
                ].map(p => (
                  <div key={p.pattern} className="rounded-lg p-4" style={{ background: 'rgba(99,102,241,0.04)', border: `1px solid ${p.color}20` }}>
                    <h4 className="text-sm font-bold mb-2" style={{ color: p.color }}>{p.pattern}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: COLORS.textDim }}>{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto px-4 py-8 text-center" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <p className="text-xs" style={{ color: COLORS.textDim }}>
          CodeVision System Architecture &mdash; Built with Next.js, Claude AI, Tree-sitter, and Supabase
        </p>
      </div>

      {/* custom scrollbar */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
