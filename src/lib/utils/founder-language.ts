const TERM_MAP: Array<[RegExp, string]> = [
  [/\bAPI\b/gi, 'service connection'],
  [/\bendpoints?\b/gi, 'integration points'],
  [/\bdatabase\b/gi, 'data store'],
  [/\bschema\b/gi, 'data blueprint'],
  [/\bqueue\b/gi, 'background task line'],
  [/\bworker\b/gi, 'background processor'],
  [/\bcron\b/gi, 'scheduled job'],
  [/\borchestration\b/gi, 'coordination'],
  [/\bdeployment\b/gi, 'release'],
  [/\bCI\/CD\b/gi, 'automated release pipeline'],
  [/\bregression\b/gi, 'unexpected breakage'],
  [/\btechnical debt\b/gi, 'maintenance burden'],
  [/\bmodule\b/gi, 'product component'],
  [/\bservice\b/gi, 'system component'],
  [/\binfrastructure\b/gi, 'platform setup'],
  [/\basynchronous\b/gi, 'background'],
  [/\bdependency\b/gi, 'external reliance'],
];

export function simplifyForFounder(text: string, founderMode: boolean): string {
  if (!founderMode) return text;
  let output = text;
  TERM_MAP.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}
