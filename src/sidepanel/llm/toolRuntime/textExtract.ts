type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object') return {};
  return value as UnknownRecord;
}

export function extractResponseText(response: unknown): string {
  const payload = asRecord(response);
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates
    : [];

  const firstCandidate = asRecord(candidates[0]);
  const content = asRecord(firstCandidate.content);
  const parts = Array.isArray(content.parts) ? content.parts : [];

  return parts
    .map((part) => asRecord(part).text)
    .filter((value): value is string => typeof value === 'string')
    .join('');
}
