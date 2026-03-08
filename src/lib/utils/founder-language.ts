const TERM_MAP: Array<[RegExp, string]> = [
  [/\bREST API\b/gi, 'system communication layer'],
  [/\bAPI endpoints?\b/gi, 'connection points between product features'],
  [/\bAPI\b/gi, 'connection method between parts of the product'],
  [/\bdatabase\b/gi, 'digital filing cabinet'],
  [/\bdata model\b/gi, 'information structure'],
  [/\bschema\b/gi, 'data blueprint'],
  [/\bauthentication\b/gi, 'login and identity checks'],
  [/\bauthorization\b/gi, 'access control rules'],
  [/\bqueue\b/gi, 'background work line'],
  [/\bworker\b/gi, 'background processor'],
  [/\bcron\b/gi, 'scheduled automation'],
  [/\basynchronous\b/gi, 'in the background'],
  [/\borchestration\b/gi, 'coordination across systems'],
  [/\bdeployment\b/gi, 'release process'],
  [/\bCI\/CD\b/gi, 'automated release pipeline'],
  [/\bregression\b/gi, 'unexpected breakage'],
  [/\btechnical debt\b/gi, 'maintenance burden'],
  [/\bmodule\b/gi, 'product component'],
  [/\bmicroservices?\b/gi, 'separate product components'],
  [/\bservice\b/gi, 'system component'],
  [/\binfrastructure\b/gi, 'platform setup'],
  [/\bdependency\b/gi, 'external reliance'],
  [/\bSDK\b/gi, 'integration toolkit'],
];

export function simplifyForFounder(text: string, founderMode: boolean): string {
  if (!founderMode) return text;
  let output = text;
  TERM_MAP.forEach(([pattern, replacement]) => {
    output = output.replace(pattern, replacement);
  });
  return output;
}
