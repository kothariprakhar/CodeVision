import type { AnalysisResult } from '@/lib/db';

type TechnologyCategory =
  | 'framework'
  | 'orm'
  | 'database'
  | 'infra'
  | 'service'
  | 'testing'
  | 'language'
  | 'tooling';

interface TechSignature {
  name: string;
  category: TechnologyCategory;
  patterns: RegExp[];
  founder_note: string;
}

export interface LanguageSlice {
  language: string;
  file_count: number;
  percentage: number;
}

export interface DetectedTechnology {
  name: string;
  category: TechnologyCategory;
  evidence: string[];
  founder_note: string;
}

export interface ComplexityFactor {
  label: string;
  value: number;
  weight: number;
  weighted_score: number;
}

export interface TechStackSnapshot {
  languages: LanguageSlice[];
  frameworks: DetectedTechnology[];
  infrastructure: DetectedTechnology[];
  external_services: DetectedTechnology[];
  architecture_pattern: {
    label: 'monolith' | 'microservices' | 'serverless' | 'hybrid' | 'unknown';
    explanation: string;
  };
  complexity_score: number;
  complexity_factors: ComplexityFactor[];
  what_this_means: Array<{
    technology: string;
    explanation: string;
  }>;
}

export interface RiskItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  category: 'security' | 'reliability' | 'delivery' | 'maintainability' | 'operations';
  business_impact: string;
  why_it_matters: string;
  estimated_effort_days: number;
  remediation_cost_usd: number;
  evidence: string[];
  source: 'static' | 'ai';
}

export interface RiskSnapshot {
  summary: string;
  totals: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  estimated_remediation_days: number;
  estimated_remediation_cost_usd: number;
  checks_run: string[];
  risks: RiskItem[];
}

interface RawSignals {
  file_manifest_paths?: string[];
  file_manifest_languages?: Record<string, number>;
  file_manifest_categories?: Record<string, number>;
  repo_metadata?: {
    contributors_count?: number;
  };
  dependency_graph_stats?: {
    max_depth?: number;
  };
}

const DAY_RATE_USD = 900;

const TECH_SIGNATURES: TechSignature[] = [
  {
    name: 'React',
    category: 'framework',
    patterns: [/\breact\b/i, /\.tsx?$/i, /jsx/i],
    founder_note: 'Popular UI framework for fast, component-driven web experiences.',
  },
  {
    name: 'Next.js',
    category: 'framework',
    patterns: [/\bnext(?:\.js)?\b/i, /app\//i, /pages\//i],
    founder_note: 'Production web framework with strong SEO, routing, and deployment ergonomics.',
  },
  {
    name: 'Vue',
    category: 'framework',
    patterns: [/\bvue\b/i, /\.vue$/i],
    founder_note: 'Front-end framework known for a gentle learning curve and rapid prototyping.',
  },
  {
    name: 'Angular',
    category: 'framework',
    patterns: [/\bangular\b/i, /@angular\//i],
    founder_note: 'Enterprise-grade front-end framework with batteries included.',
  },
  {
    name: 'FastAPI',
    category: 'framework',
    patterns: [/\bfastapi\b/i, /fastapi\(/i],
    founder_note: 'High-performance Python API framework, good for typed and maintainable services.',
  },
  {
    name: 'Django',
    category: 'framework',
    patterns: [/\bdjango\b/i, /manage\.py/i, /settings\.py/i],
    founder_note: 'Mature Python framework that speeds up secure product delivery.',
  },
  {
    name: 'Flask',
    category: 'framework',
    patterns: [/\bflask\b/i],
    founder_note: 'Lightweight Python framework useful for focused APIs and small services.',
  },
  {
    name: 'Express',
    category: 'framework',
    patterns: [/\bexpress\b/i],
    founder_note: 'Widely used Node.js backend framework for web APIs.',
  },
  {
    name: 'NestJS',
    category: 'framework',
    patterns: [/\bnestjs\b/i, /@nestjs\//i],
    founder_note: 'Structured Node framework that scales well for larger engineering teams.',
  },
  {
    name: 'Spring Boot',
    category: 'framework',
    patterns: [/springboot/i, /org\.springframework/i],
    founder_note: 'Robust Java framework for complex, enterprise-grade backends.',
  },
  {
    name: 'SQLAlchemy',
    category: 'orm',
    patterns: [/sqlalchemy/i],
    founder_note: 'Python ORM used to safely map business entities to relational databases.',
  },
  {
    name: 'Prisma',
    category: 'orm',
    patterns: [/\bprisma\b/i],
    founder_note: 'Type-safe database toolkit that reduces query bugs in production.',
  },
  {
    name: 'TypeORM',
    category: 'orm',
    patterns: [/typeorm/i],
    founder_note: 'Node ORM helping model-driven access to SQL databases.',
  },
  {
    name: 'PostgreSQL',
    category: 'database',
    patterns: [/postgres/i, /psycopg/i, /postgresql/i],
    founder_note: 'Reliable relational database used by many high-scale products.',
  },
  {
    name: 'MySQL',
    category: 'database',
    patterns: [/mysql/i],
    founder_note: 'Popular SQL database for transactional and reporting workloads.',
  },
  {
    name: 'MongoDB',
    category: 'database',
    patterns: [/mongodb/i, /mongoose/i],
    founder_note: 'Document database useful for flexible schemas and rapid iteration.',
  },
  {
    name: 'Redis',
    category: 'database',
    patterns: [/redis/i],
    founder_note: 'In-memory store used for caching, queues, and speed-critical operations.',
  },
  {
    name: 'Elasticsearch',
    category: 'database',
    patterns: [/elasticsearch/i],
    founder_note: 'Search engine stack for fast full-text search and analytics.',
  },
  {
    name: 'Docker',
    category: 'infra',
    patterns: [/dockerfile/i, /docker-compose/i, /\bdocker\b/i],
    founder_note: 'Containerization improves environment consistency and deploy reliability.',
  },
  {
    name: 'Kubernetes',
    category: 'infra',
    patterns: [/kubernetes/i, /\bk8s\b/i, /helm/i],
    founder_note: 'Container orchestration suited for multi-service scaling and resilience.',
  },
  {
    name: 'Terraform',
    category: 'infra',
    patterns: [/terraform/i, /\.tf$/i],
    founder_note: 'Infrastructure-as-code that makes cloud setup auditable and repeatable.',
  },
  {
    name: 'GitHub Actions',
    category: 'tooling',
    patterns: [/\.github\/workflows/i, /github actions/i],
    founder_note: 'Automated CI/CD for faster and safer software releases.',
  },
  {
    name: 'CircleCI',
    category: 'tooling',
    patterns: [/circleci/i, /\.circleci/i],
    founder_note: 'CI/CD tooling to automate testing and deployment workflows.',
  },
  {
    name: 'Jest',
    category: 'testing',
    patterns: [/\bjest\b/i],
    founder_note: 'Unit testing framework that improves confidence in code changes.',
  },
  {
    name: 'Pytest',
    category: 'testing',
    patterns: [/\bpytest\b/i],
    founder_note: 'Popular Python testing framework for regression safety.',
  },
  {
    name: 'Playwright',
    category: 'testing',
    patterns: [/playwright/i],
    founder_note: 'End-to-end browser testing to prevent user-facing regressions.',
  },
  {
    name: 'Cypress',
    category: 'testing',
    patterns: [/cypress/i],
    founder_note: 'Front-end E2E testing framework focused on real user journeys.',
  },
  {
    name: 'Stripe',
    category: 'service',
    patterns: [/\bstripe\b/i],
    founder_note: 'Payments platform that accelerates monetization features.',
  },
  {
    name: 'Twilio',
    category: 'service',
    patterns: [/\btwilio\b/i],
    founder_note: 'Communication API provider for SMS, OTP, and call workflows.',
  },
  {
    name: 'SendGrid',
    category: 'service',
    patterns: [/sendgrid/i],
    founder_note: 'Email delivery platform for transactional and campaign messaging.',
  },
  {
    name: 'Resend',
    category: 'service',
    patterns: [/\bresend\b/i],
    founder_note: 'Modern email API often used for product notifications and verification.',
  },
  {
    name: 'AWS',
    category: 'infra',
    patterns: [/\baws\b/i, /\bs3\b/i, /lambda/i, /cloudfront/i],
    founder_note: 'Cloud platform with broad infrastructure and managed services.',
  },
  {
    name: 'GCP',
    category: 'infra',
    patterns: [/\bgcp\b/i, /google cloud/i],
    founder_note: 'Google cloud stack for compute, storage, analytics, and ML.',
  },
  {
    name: 'Azure',
    category: 'infra',
    patterns: [/\bazure\b/i],
    founder_note: 'Microsoft cloud platform often used in enterprise deployments.',
  },
  {
    name: 'Supabase',
    category: 'service',
    patterns: [/supabase/i],
    founder_note: 'Managed backend platform for auth, database, and storage.',
  },
  {
    name: 'Firebase',
    category: 'service',
    patterns: [/firebase/i],
    founder_note: 'Managed app backend with real-time and auth capabilities.',
  },
  {
    name: 'Python',
    category: 'language',
    patterns: [/\bpython\b/i, /\.py$/i],
    founder_note: 'Versatile language favored for backend, automation, and data workflows.',
  },
  {
    name: 'TypeScript',
    category: 'language',
    patterns: [/typescript/i, /\.ts$/i, /\.tsx$/i],
    founder_note: 'Typed JavaScript that reduces runtime bugs as products scale.',
  },
  {
    name: 'JavaScript',
    category: 'language',
    patterns: [/javascript/i, /\.js$/i, /\.jsx$/i],
    founder_note: 'Core language of web applications across front-end and Node backends.',
  },
  {
    name: 'Go',
    category: 'language',
    patterns: [/\bgo\b/i, /\.go$/i],
    founder_note: 'Compiled language with strong performance and operational simplicity.',
  },
  {
    name: 'Java',
    category: 'language',
    patterns: [/\bjava\b/i, /\.java$/i],
    founder_note: 'Mature language with extensive ecosystem for large systems.',
  },
  {
    name: 'Rust',
    category: 'language',
    patterns: [/\brust\b/i, /\.rs$/i],
    founder_note: 'Systems language known for performance and memory safety.',
  },
  {
    name: 'Serverless',
    category: 'infra',
    patterns: [/serverless/i, /lambda/i, /vercel/i, /netlify/i],
    founder_note: 'Execution model that scales automatically and reduces ops overhead.',
  },
  {
    name: 'RabbitMQ',
    category: 'infra',
    patterns: [/rabbitmq/i, /amqp/i],
    founder_note: 'Message broker used for asynchronous, resilient workflows.',
  },
  {
    name: 'Kafka',
    category: 'infra',
    patterns: [/kafka/i],
    founder_note: 'Event streaming platform for high-volume real-time pipelines.',
  },
  {
    name: 'Sentry',
    category: 'tooling',
    patterns: [/sentry/i],
    founder_note: 'Error monitoring platform for faster incident detection.',
  },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toTitle(input: string): string {
  if (!input) return 'Unknown';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function normalizeExternalServiceName(input: string): string {
  return input.replace(/^external:/i, '').trim();
}

function parseRawResponse(rawResponse: string): Record<string, unknown> | null {
  if (!rawResponse) return null;
  try {
    const parsed = JSON.parse(rawResponse) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readRawSignals(raw: Record<string, unknown> | null): RawSignals {
  if (!raw) return {};
  const deterministic = raw.deterministic_signals;
  if (!deterministic || typeof deterministic !== 'object' || Array.isArray(deterministic)) {
    return {};
  }

  const typed = deterministic as Record<string, unknown>;

  const file_manifest_paths = Array.isArray(typed.file_manifest_paths)
    ? typed.file_manifest_paths.filter((item): item is string => typeof item === 'string')
    : undefined;

  const file_manifest_languages = typed.file_manifest_languages
    && typeof typed.file_manifest_languages === 'object'
    && !Array.isArray(typed.file_manifest_languages)
    ? Object.fromEntries(
      Object.entries(typed.file_manifest_languages as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => [key, value as number])
    )
    : undefined;

  const file_manifest_categories = typed.file_manifest_categories
    && typeof typed.file_manifest_categories === 'object'
    && !Array.isArray(typed.file_manifest_categories)
    ? Object.fromEntries(
      Object.entries(typed.file_manifest_categories as Record<string, unknown>)
        .filter(([, value]) => typeof value === 'number')
        .map(([key, value]) => [key, value as number])
    )
    : undefined;

  const repoMetaRaw = typed.repo_metadata;
  const repo_metadata = repoMetaRaw && typeof repoMetaRaw === 'object' && !Array.isArray(repoMetaRaw)
    ? {
      contributors_count:
        typeof (repoMetaRaw as Record<string, unknown>).contributors_count === 'number'
          ? (repoMetaRaw as Record<string, unknown>).contributors_count as number
          : undefined,
    }
    : undefined;

  const depStatsRaw = typed.dependency_graph_stats;
  const dependency_graph_stats = depStatsRaw && typeof depStatsRaw === 'object' && !Array.isArray(depStatsRaw)
    ? {
      max_depth:
        typeof (depStatsRaw as Record<string, unknown>).max_depth === 'number'
          ? (depStatsRaw as Record<string, unknown>).max_depth as number
          : undefined,
    }
    : undefined;

  return {
    file_manifest_paths,
    file_manifest_languages,
    file_manifest_categories,
    repo_metadata,
    dependency_graph_stats,
  };
}

function collectTextSignals(analysis: AnalysisResult, raw: Record<string, unknown> | null, rawSignals: RawSignals): string[] {
  const values: string[] = [];
  values.push(analysis.summary || '');
  values.push(...(analysis.findings || []).flatMap(finding => [
    finding.title,
    finding.description,
    ...(finding.evidence || []),
  ]));

  values.push(...(analysis.architecture?.nodes || []).flatMap(node => [
    node.name,
    node.type,
    node.description,
    ...(node.files || []),
  ]));

  values.push(...(rawSignals.file_manifest_paths || []));

  const pass1 = raw?.pass1;
  if (pass1 && typeof pass1 === 'object' && !Array.isArray(pass1)) {
    const moduleSummaries = (pass1 as Record<string, unknown>).module_summaries;
    if (moduleSummaries && typeof moduleSummaries === 'object' && !Array.isArray(moduleSummaries)) {
      Object.values(moduleSummaries as Record<string, unknown>).forEach(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        const item = value as Record<string, unknown>;
        if (typeof item.plain_summary === 'string') values.push(item.plain_summary);
        if (typeof item.business_function === 'string') values.push(item.business_function);
        if (Array.isArray(item.key_technologies)) {
          values.push(...item.key_technologies.filter((entry): entry is string => typeof entry === 'string'));
        }
      });
    }
  }

  const pass3 = raw?.pass3;
  if (pass3 && typeof pass3 === 'object' && !Array.isArray(pass3)) {
    const deps = (pass3 as Record<string, unknown>).external_deps;
    if (Array.isArray(deps)) {
      deps.forEach((dep) => {
        if (typeof dep === 'string') {
          values.push(dep);
          return;
        }
        if (!dep || typeof dep !== 'object' || Array.isArray(dep)) return;
        const depObj = dep as Record<string, unknown>;
        if (typeof depObj.name === 'string') values.push(depObj.name);
        if (typeof depObj.why_needed === 'string') values.push(depObj.why_needed);
        if (typeof depObj.what_breaks_without_it === 'string') values.push(depObj.what_breaks_without_it);
      });
    }
  }

  return values;
}

function collectPass3ExternalServiceNames(raw: Record<string, unknown> | null): string[] {
  const pass3 = raw?.pass3;
  if (!pass3 || typeof pass3 !== 'object' || Array.isArray(pass3)) return [];
  const deps = (pass3 as Record<string, unknown>).external_deps;
  if (!Array.isArray(deps)) return [];

  const names: string[] = [];
  deps.forEach((dep) => {
    if (typeof dep === 'string') {
      names.push(normalizeExternalServiceName(dep));
      return;
    }
    if (!dep || typeof dep !== 'object' || Array.isArray(dep)) return;
    const depObj = dep as Record<string, unknown>;
    if (typeof depObj.name === 'string') {
      names.push(normalizeExternalServiceName(depObj.name));
    }
  });
  return names.filter(Boolean);
}

function buildExternalServices(
  analysis: AnalysisResult,
  raw: Record<string, unknown> | null,
  detected: DetectedTechnology[]
): DetectedTechnology[] {
  const signatureNoteByName = new Map(
    TECH_SIGNATURES
      .filter(item => item.category === 'service')
      .map(item => [item.name.toLowerCase(), item.founder_note])
  );

  const merged = new Map<string, DetectedTechnology>();

  const register = (nameRaw: string, evidenceRaw: string, founderNote?: string) => {
    const name = normalizeExternalServiceName(nameRaw);
    if (!name) return;
    const key = name.toLowerCase();
    const evidence = normalizeExternalServiceName(evidenceRaw) || 'inferred_external_signal';
    const note = founderNote
      || signatureNoteByName.get(key)
      || 'Third-party integration used by this system.';

    if (!merged.has(key)) {
      merged.set(key, {
        name,
        category: 'service',
        evidence: [evidence],
        founder_note: note,
      });
      return;
    }

    const existing = merged.get(key) as DetectedTechnology;
    if (!existing.evidence.includes(evidence)) {
      existing.evidence = [...existing.evidence, evidence].slice(0, 5);
    }
  };

  detected
    .filter(item => item.category === 'service')
    .forEach((item) => register(item.name, item.evidence[0] || 'tech_signature', item.founder_note));

  (analysis.business_context?.external_deps || []).forEach((dep) => {
    register(dep.name, 'business_context.external_deps', dep.why_needed || undefined);
  });

  (analysis.architecture?.nodes || [])
    .filter(node => node.type === 'external' || node.id.startsWith('external:'))
    .forEach((node) => {
      const candidate = normalizeExternalServiceName(node.name || node.id);
      register(candidate, `architecture.node:${node.id}`);
    });

  collectPass3ExternalServiceNames(raw).forEach((name) => {
    register(name, 'pass3.external_deps');
  });

  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function matchTechnologies(signalText: string[]): DetectedTechnology[] {
  const joined = signalText.join('\n');
  const matches: DetectedTechnology[] = [];

  TECH_SIGNATURES.forEach(signature => {
    const evidence = signature.patterns
      .filter(pattern => pattern.test(joined))
      .map(pattern => pattern.source)
      .slice(0, 3);
    if (evidence.length === 0) return;
    matches.push({
      name: signature.name,
      category: signature.category,
      evidence,
      founder_note: signature.founder_note,
    });
  });

  return matches;
}

function deriveLanguageDistribution(analysis: AnalysisResult, rawSignals: RawSignals): LanguageSlice[] {
  const counts = new Map<string, number>();

  if (rawSignals.file_manifest_languages) {
    Object.entries(rawSignals.file_manifest_languages).forEach(([language, count]) => {
      counts.set(language, count);
    });
  } else {
    const filePaths = [
      ...(rawSignals.file_manifest_paths || []),
      ...(analysis.architecture?.nodes || []).flatMap(node => node.files || []),
    ];
    filePaths.forEach(filePath => {
      const lower = filePath.toLowerCase();
      if (lower.endsWith('.py')) counts.set('python', (counts.get('python') || 0) + 1);
      else if (lower.endsWith('.ts') || lower.endsWith('.tsx')) counts.set('typescript', (counts.get('typescript') || 0) + 1);
      else if (lower.endsWith('.js') || lower.endsWith('.jsx')) counts.set('javascript', (counts.get('javascript') || 0) + 1);
      else if (lower.endsWith('.go')) counts.set('go', (counts.get('go') || 0) + 1);
      else if (lower.endsWith('.java')) counts.set('java', (counts.get('java') || 0) + 1);
      else if (lower.endsWith('.rb')) counts.set('ruby', (counts.get('ruby') || 0) + 1);
      else if (lower.endsWith('.rs')) counts.set('rust', (counts.get('rust') || 0) + 1);
    });
  }

  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0) || 1;

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([language, file_count]) => ({
      language: toTitle(language),
      file_count,
      percentage: Number(((file_count / total) * 100).toFixed(1)),
    }));
}

function estimateDependencyDepth(analysis: AnalysisResult): number {
  const nodes = analysis.architecture?.nodes || [];
  const edges = analysis.architecture?.edges || [];
  if (nodes.length === 0 || edges.length === 0) return 1;

  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  nodes.forEach(node => {
    adjacency.set(node.id, []);
    indegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) return;
    adjacency.get(edge.from)?.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
  });

  const queue: string[] = nodes
    .filter(node => (indegree.get(node.id) || 0) === 0)
    .map(node => node.id);

  const depth = new Map<string, number>();
  nodes.forEach(node => depth.set(node.id, 1));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) || 1;
    (adjacency.get(current) || []).forEach(next => {
      if (currentDepth + 1 > (depth.get(next) || 1)) {
        depth.set(next, currentDepth + 1);
      }
      indegree.set(next, (indegree.get(next) || 0) - 1);
      if ((indegree.get(next) || 0) === 0) {
        queue.push(next);
      }
    });
  }

  return Math.max(1, ...Array.from(depth.values()));
}

function determineArchitecturePattern(
  analysis: AnalysisResult,
  detected: DetectedTechnology[],
  rawSignals: RawSignals
): TechStackSnapshot['architecture_pattern'] {
  const paths = rawSignals.file_manifest_paths || [];
  const hasServiceBoundaries = paths.some(path => /(^|\/)(services|apps|packages)\//i.test(path));
  const hasServerless = detected.some(item => item.name === 'Serverless');

  const entryPoints = paths.filter(path => /(^|\/)(main|server|app|index)\.(ts|tsx|js|jsx|py|go|java)$/i.test(path)).length;
  const serviceNodes = (analysis.architecture?.nodes || []).filter(node => node.type === 'service' || node.type === 'api').length;

  if (hasServerless && (hasServiceBoundaries || serviceNodes >= 5)) {
    return {
      label: 'hybrid',
      explanation: 'Combination of service boundaries and serverless execution. Good flexibility, but operational governance matters.',
    };
  }

  if (hasServerless) {
    return {
      label: 'serverless',
      explanation: 'Most execution appears event/function-driven, which reduces ops overhead but can increase observability complexity.',
    };
  }

  if (hasServiceBoundaries || serviceNodes >= 7 || entryPoints >= 4) {
    return {
      label: 'microservices',
      explanation: 'System appears split into multiple services. This supports team scaling but requires stronger coordination and monitoring.',
    };
  }

  if ((analysis.architecture?.nodes || []).length > 0) {
    return {
      label: 'monolith',
      explanation: 'Most functionality seems centralized in one deployable system. Faster to iterate early, but modular discipline is important as scope grows.',
    };
  }

  return {
    label: 'unknown',
    explanation: 'Not enough architecture signals were available to classify confidently.',
  };
}

function normalize(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(1, value / cap));
}

function buildComplexity(
  analysis: AnalysisResult,
  tech: DetectedTechnology[],
  languages: LanguageSlice[],
  architecturePattern: TechStackSnapshot['architecture_pattern'],
  rawSignals: RawSignals
): { score: number; factors: ComplexityFactor[] } {
  const numLanguages = languages.length;
  const numServices = (analysis.architecture?.nodes || []).filter(node => node.type === 'service' || node.type === 'api').length;
  const numExternalDeps = tech.filter(item => item.category === 'service').length;

  const totalFiles = rawSignals.file_manifest_paths?.length
    || (analysis.architecture?.nodes || []).reduce((sum, node) => sum + (node.files?.length || 0), 0);

  const maxDependencyDepth = rawSignals.dependency_graph_stats?.max_depth || estimateDependencyDepth(analysis);
  const hasMicroservices = architecturePattern.label === 'microservices' || architecturePattern.label === 'hybrid' ? 1 : 0;
  const hasAsyncPatterns =
    tech.some(item => ['RabbitMQ', 'Kafka', 'Redis', 'Serverless'].includes(item.name))
      || (analysis.architecture?.nodes || []).some(node => /queue|worker/i.test(node.name))
      ? 1
      : 0;

  const numDbTypes = tech.filter(item => item.category === 'database').length;

  const factors: ComplexityFactor[] = [
    {
      label: 'Language surface area',
      value: numLanguages,
      weight: 0.15,
      weighted_score: normalize(numLanguages, 5) * 0.15,
    },
    {
      label: 'Service count',
      value: numServices,
      weight: 0.2,
      weighted_score: normalize(numServices, 20) * 0.2,
    },
    {
      label: 'External dependencies',
      value: numExternalDeps,
      weight: 0.15,
      weighted_score: normalize(numExternalDeps, 15) * 0.15,
    },
    {
      label: 'Codebase size (files)',
      value: totalFiles,
      weight: 0.1,
      weighted_score: normalize(totalFiles, 1500) * 0.1,
    },
    {
      label: 'Dependency depth',
      value: maxDependencyDepth,
      weight: 0.15,
      weighted_score: normalize(maxDependencyDepth, 9) * 0.15,
    },
    {
      label: 'Service architecture',
      value: hasMicroservices,
      weight: 0.1,
      weighted_score: hasMicroservices * 0.1,
    },
    {
      label: 'Async/event patterns',
      value: hasAsyncPatterns,
      weight: 0.05,
      weighted_score: hasAsyncPatterns * 0.05,
    },
    {
      label: 'Database variety',
      value: numDbTypes,
      weight: 0.1,
      weighted_score: normalize(numDbTypes, 3) * 0.1,
    },
  ];

  const rawScore = factors.reduce((sum, factor) => sum + factor.weighted_score, 0);
  const normalized = 1 + rawScore * 9;
  return {
    score: Number(normalized.toFixed(1)),
    factors,
  };
}

export function buildTechStackSnapshot(analysis: AnalysisResult): TechStackSnapshot {
  const raw = parseRawResponse(analysis.raw_response);
  const rawSignals = readRawSignals(raw);
  const signalText = collectTextSignals(analysis, raw, rawSignals);
  const detected = matchTechnologies(signalText);

  const languages = deriveLanguageDistribution(analysis, rawSignals);
  const frameworks = detected.filter(item => ['framework', 'orm', 'testing'].includes(item.category));
  const infrastructure = detected.filter(item => ['infra', 'tooling'].includes(item.category));
  const externalServices = buildExternalServices(analysis, raw, detected);

  const architecturePattern = determineArchitecturePattern(analysis, detected, rawSignals);
  const complexity = buildComplexity(analysis, detected, languages, architecturePattern, rawSignals);

  const meaningCards = unique(
    detected
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 18)
      .map(item => `${item.name}|||${item.founder_note}`)
  ).map(value => {
    const [technology, explanation] = value.split('|||');
    return { technology, explanation };
  });

  return {
    languages,
    frameworks,
    infrastructure,
    external_services: externalServices,
    architecture_pattern: architecturePattern,
    complexity_score: complexity.score,
    complexity_factors: complexity.factors,
    what_this_means: meaningCards,
  };
}

function aiFindingToRisk(analysis: AnalysisResult): RiskItem[] {
  return (analysis.findings || []).map((finding, index) => {
    const severity = finding.severity;
    const effort = severity === 'critical' ? 8 : severity === 'high' ? 5 : severity === 'medium' ? 3 : 1;
    const category: RiskItem['category'] = /security|secret|auth|token|password|exposure/i.test(
      `${finding.title} ${finding.description}`
    )
      ? 'security'
      : /failure|outage|error|downtime|reliab/i.test(`${finding.title} ${finding.description}`)
        ? 'reliability'
        : finding.type === 'gap'
          ? 'delivery'
          : 'maintainability';

    return {
      id: `ai-${index + 1}`,
      severity,
      title: finding.title,
      category,
      business_impact: finding.description,
      why_it_matters: finding.type === 'gap'
        ? 'Missing capability can slow roadmap execution and delay business outcomes.'
        : 'Implementation mismatch can raise operational cost and reduce product trust.',
      estimated_effort_days: effort,
      remediation_cost_usd: effort * DAY_RATE_USD,
      evidence: finding.evidence || [],
      source: 'ai',
    };
  });
}

function staticCheckRisks(analysis: AnalysisResult, tech: TechStackSnapshot): RiskItem[] {
  const raw = parseRawResponse(analysis.raw_response);
  const rawSignals = readRawSignals(raw);
  const manifestPaths = rawSignals.file_manifest_paths || [];
  const pathBlob = manifestPaths.join('\n').toLowerCase();
  const risks: RiskItem[] = [];

  const hasTests = tech.frameworks.some(item => item.category === 'testing')
    || /__tests__|\.test\.|\.spec\.|tests\//i.test(pathBlob)
    || (rawSignals.file_manifest_categories?.test || 0) > 0;
  if (!hasTests) {
    risks.push({
      id: 'static-no-tests',
      severity: 'high',
      title: 'No clear automated test suite detected',
      category: 'reliability',
      business_impact: 'Each release carries higher regression risk and can increase incident frequency.',
      why_it_matters: 'Without test safety nets, delivery speed drops over time as fear of breakage rises.',
      estimated_effort_days: 6,
      remediation_cost_usd: 6 * DAY_RATE_USD,
      evidence: ['No test frameworks or test directories detected'],
      source: 'static',
    });
  }

  const hasCICD = tech.infrastructure.some(item => /github actions|circleci/i.test(item.name))
    || /\.github\/workflows|\.circleci|gitlab-ci|jenkins/i.test(pathBlob);
  if (!hasCICD) {
    risks.push({
      id: 'static-no-cicd',
      severity: 'medium',
      title: 'CI/CD automation appears limited',
      category: 'delivery',
      business_impact: 'Manual release steps increase deployment time and operational overhead.',
      why_it_matters: 'Delivery throughput and release reliability both depend on repeatable automation.',
      estimated_effort_days: 3,
      remediation_cost_usd: 3 * DAY_RATE_USD,
      evidence: ['No CI workflow files detected'],
      source: 'static',
    });
  }

  const hasDocker = tech.infrastructure.some(item => item.name === 'Docker') || /dockerfile|docker-compose/i.test(pathBlob);
  if (!hasDocker) {
    risks.push({
      id: 'static-no-container',
      severity: 'low',
      title: 'Containerization signal missing',
      category: 'operations',
      business_impact: 'Environment inconsistencies can slow onboarding and deployment troubleshooting.',
      why_it_matters: 'Containerized environments reduce “works on my machine” risk.',
      estimated_effort_days: 2,
      remediation_cost_usd: 2 * DAY_RATE_USD,
      evidence: ['No Dockerfile or docker-compose configuration found'],
      source: 'static',
    });
  }

  const hasEnvExample = /\.env\.example|\.env\.sample|example\.env/i.test(pathBlob);
  if (!hasEnvExample) {
    risks.push({
      id: 'static-no-env-example',
      severity: 'medium',
      title: 'Missing environment template',
      category: 'operations',
      business_impact: 'Configuration mistakes can block onboarding and create avoidable runtime failures.',
      why_it_matters: 'A clear env template is a low-cost way to reduce support burden.',
      estimated_effort_days: 1,
      remediation_cost_usd: 1 * DAY_RATE_USD,
      evidence: ['No .env.example/.env.sample file detected'],
      source: 'static',
    });
  }

  const largeModules = (analysis.architecture?.nodes || [])
    .filter(node => (node.files?.length || 0) >= 30)
    .map(node => `${node.name} (${node.files.length} files)`)
    .slice(0, 4);
  if (largeModules.length > 0) {
    risks.push({
      id: 'static-large-modules',
      severity: 'medium',
      title: 'Large modules may increase maintenance drag',
      category: 'maintainability',
      business_impact: 'Large components are slower to change and can accumulate hidden defects.',
      why_it_matters: 'Refactoring high-churn hotspots lowers long-term feature cost.',
      estimated_effort_days: 4,
      remediation_cost_usd: 4 * DAY_RATE_USD,
      evidence: largeModules,
      source: 'static',
    });
  }

  const contributors = rawSignals.repo_metadata?.contributors_count;
  if (typeof contributors === 'number' && contributors <= 1) {
    risks.push({
      id: 'static-bus-factor',
      severity: 'high',
      title: 'Single-contributor dependency risk',
      category: 'delivery',
      business_impact: 'Knowledge concentration can slow execution if the primary engineer is unavailable.',
      why_it_matters: 'Bus factor risk impacts roadmap predictability and investor confidence.',
      estimated_effort_days: 5,
      remediation_cost_usd: 5 * DAY_RATE_USD,
      evidence: [`Contributors detected: ${contributors}`],
      source: 'static',
    });
  }

  const securitySignals = (analysis.findings || []).filter(finding => /secret|api key|token|credential|password|hardcoded/i.test(`${finding.title} ${finding.description}`));
  if (securitySignals.length > 0) {
    risks.push({
      id: 'static-security-signal',
      severity: 'critical',
      title: 'Security exposure indicators detected',
      category: 'security',
      business_impact: 'Potential credential/data exposure can create legal, financial, and trust damage.',
      why_it_matters: 'Security incidents are expensive and can materially impact customer retention.',
      estimated_effort_days: 7,
      remediation_cost_usd: 7 * DAY_RATE_USD,
      evidence: securitySignals.slice(0, 3).map(item => item.title),
      source: 'static',
    });
  }

  return risks;
}

export function buildRiskSnapshot(analysis: AnalysisResult): RiskSnapshot {
  const tech = buildTechStackSnapshot(analysis);
  const staticRisks = staticCheckRisks(analysis, tech);
  const aiRisks = aiFindingToRisk(analysis);

  const all = [...staticRisks, ...aiRisks];
  const dedupedMap = new Map<string, RiskItem>();
  all.forEach(risk => {
    const key = `${risk.title.toLowerCase()}::${risk.severity}`;
    if (!dedupedMap.has(key)) dedupedMap.set(key, risk);
  });

  const risks = Array.from(dedupedMap.values()).sort((a, b) => {
    const rank = (severity: RiskItem['severity']): number => {
      if (severity === 'critical') return 4;
      if (severity === 'high') return 3;
      if (severity === 'medium') return 2;
      return 1;
    };
    return rank(b.severity) - rank(a.severity);
  });

  const totals = {
    critical: risks.filter(risk => risk.severity === 'critical').length,
    high: risks.filter(risk => risk.severity === 'high').length,
    medium: risks.filter(risk => risk.severity === 'medium').length,
    low: risks.filter(risk => risk.severity === 'low').length,
  };

  const estimatedDays = risks.reduce((sum, risk) => sum + risk.estimated_effort_days, 0);
  const estimatedCost = risks.reduce((sum, risk) => sum + risk.remediation_cost_usd, 0);

  const summary = totals.critical > 0
    ? `${totals.critical} critical risks require immediate mitigation before aggressive scaling.`
    : totals.high > 0
      ? `${totals.high} high-priority risks identified; address these before major roadmap commitments.`
      : 'No critical blockers detected; continue with planned delivery while addressing medium-risk debt.';

  return {
    summary,
    totals,
    estimated_remediation_days: estimatedDays,
    estimated_remediation_cost_usd: estimatedCost,
    checks_run: [
      'test coverage presence',
      'CI/CD workflow detection',
      'containerization detection',
      'environment template detection',
      'large module hotspot detection',
      'contributor concentration signal',
      'security keyword risk signal',
      'AI finding normalization',
    ],
    risks,
  };
}

export function buildStarterQuestions(analysis: AnalysisResult): string[] {
  const tech = buildTechStackSnapshot(analysis);
  const topModule = analysis.architecture?.nodes?.[0]?.name || 'the core service';

  const candidates = [
    `How does ${topModule} create business value?`,
    'Where could this system fail first during growth?',
    'What does the authentication path look like for a new user?',
    'Which dependencies are most critical to keep this product running?',
    tech.external_services[0]
      ? `Why is ${tech.external_services[0].name} used and what happens if it fails?`
      : 'What external services does this product rely on the most?',
    'If we had 2 weeks to reduce risk, what should we fix first?',
  ];

  return candidates.slice(0, 4);
}
