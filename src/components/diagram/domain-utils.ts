import type { ArchitectureDomain, ArchitectureNode } from './types';

const HINT_COLORS: Record<string, string> = {
  blue: 'hsl(220, 80%, 60%)',
  green: 'hsl(150, 70%, 50%)',
  purple: 'hsl(280, 65%, 55%)',
  orange: 'hsl(25, 90%, 55%)',
  red: 'hsl(340, 75%, 55%)',
  teal: 'hsl(180, 60%, 45%)',
  yellow: 'hsl(45, 90%, 55%)',
  pink: 'hsl(330, 70%, 60%)',
  gray: 'hsl(200, 20%, 50%)',
  grey: 'hsl(200, 20%, 50%)',
};

const LEGACY_DOMAIN_COLORS: Record<string, string> = {
  auth: 'hsl(220, 80%, 60%)',
  data: 'hsl(160, 70%, 45%)',
  payments: 'hsl(45, 90%, 55%)',
  comms: 'hsl(280, 65%, 55%)',
  core: 'hsl(340, 75%, 55%)',
  infra: 'hsl(200, 20%, 50%)',
};

export function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

export function inferFallbackDomain(text: string): string {
  const lower = normalizeKey(text);
  if (/(auth|login|signup|session|permission|identity)/.test(lower)) return 'auth';
  if (/(db|data|model|schema|storage|warehouse|cache)/.test(lower)) return 'data';
  if (/(payment|billing|invoice|checkout|subscription|pricing)/.test(lower)) return 'payments';
  if (/(message|email|sms|notification|chat|webhook|comms)/.test(lower)) return 'comms';
  if (/(infra|deployment|ops|k8s|docker|queue|worker|scheduler)/.test(lower)) return 'infra';
  return 'core';
}

export function colorFromDomain(domain: string): string {
  if (LEGACY_DOMAIN_COLORS[domain]) return LEGACY_DOMAIN_COLORS[domain];
  let hash = 0;
  for (let i = 0; i < domain.length; i += 1) {
    hash = (hash << 5) - hash + domain.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 68%, 58%)`;
}

export function buildDomainColors(architectureDomains: ArchitectureDomain[] | undefined, domains: string[]): Record<string, string> {
  const colors: Record<string, string> = {};

  domains.forEach((domain) => {
    colors[domain] = colorFromDomain(domain);
  });

  (architectureDomains || []).forEach((domain) => {
    const hint = normalizeKey(domain.color_hint);
    colors[domain.name] = HINT_COLORS[hint] || colorFromDomain(domain.name);
  });

  return colors;
}

export function buildNodeDomainMap(nodes: ArchitectureNode[], architectureDomains?: ArchitectureDomain[]): Map<string, string> {
  const byModule = new Map<string, string>();
  (architectureDomains || []).forEach((domain) => {
    domain.modules.forEach((moduleName) => {
      byModule.set(normalizeKey(moduleName), domain.name);
    });
  });

  const mapping = new Map<string, string>();
  nodes.forEach((node) => {
    const matched = byModule.get(normalizeKey(node.id))
      || byModule.get(normalizeKey(node.name))
      || inferFallbackDomain(`${node.name} ${node.description} ${(node.files || []).join(' ')}`);
    mapping.set(node.id, matched);
  });

  return mapping;
}

