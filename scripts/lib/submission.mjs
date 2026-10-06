import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const METRICS = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens', 'agentSeconds', 'costUsd'];
export const nonempty = x => typeof x === 'string' && x.trim().length > 0 && !/^(TODO|TBD|REPLACE|UNKNOWN)$/i.test(x.trim());
export const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error(`Unsafe path: ${relative}`);
  const realRoot = fs.realpathSync(root);
  const full = path.resolve(realRoot, relative);
  const real = fs.realpathSync(full);
  if (!real.startsWith(realRoot + path.sep) || real !== full || !fs.statSync(full).isFile()) throw new Error(`Not a regular in-repository file: ${relative}`);
  return full;
}
export function makeSubmission(bounty = null) {
  const id = randomUUID();
  return {
    schemaVersion: 1, submissionId: id, type: bounty ? 'research' : 'infrastructure',
    bountyId: bounty?.id ?? null,
    scope: bounty ? { author: bounty.author, work: bounty.work, unit: bounty.unit, citationScheme: bounty.citationScheme } : null,
    status: 'draft',
    agents: [{ id: 'lead', role: 'lead', provider: 'Anthropic', modelName: '', modelId: '', runtime: '', runtimeVersion: '', sessionId: '', reasoningEffort: '', thinkingMode: '', thinkingBudgetTokens: null, metrics: Object.fromEntries(METRICS.map(k => [k, null])), unavailableReason: '' }],
    subagentCount: 0,
    usage: { startedAt: new Date().toISOString(), finishedAt: null, wallSeconds: null, ...Object.fromEntries(METRICS.map(k => [k, null])), measurementSource: '', unavailableReason: '' },
    provenance: { statement: '', evidenceFiles: [], limitations: '' },
    completeness: { overallPercent: 0, translatedLines: 0, analyzedTokens: 0, reviewedLines: 0, remainingGaps: [] },
    research: bounty ? { coverageFile: `research/${bounty.id}/${id}/coverage.json`, sourcesFile: `research/${bounty.id}/${id}/sources.json`, candidatesFile: `research/${bounty.id}/${id}/candidates.json`, categoriesFile: `research/${bounty.id}/${id}/categories.json`, audits: [] } : null,
    changes: '', validation: [], payout: { method: 'arrange-after-acceptance', contact: '' }
  };
}

export function validateMetadata(m, { policy, bounty, root }) {
  const errors = [];
  const need = (ok, message) => { if (!ok) errors.push(message); };
  const file = (p, what) => {
    try { const f = safeFile(root, p); need(fs.statSync(f).size > 0, `${what} is empty`); return f; }
    catch (e) { errors.push(`${what}: ${e.message}`); return null; }
  };
  need(m.schemaVersion === 1, 'schemaVersion must be 1');
  need(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(m.submissionId), 'submissionId must be a UUID v4');
  need(['research', 'infrastructure'].includes(m.type), 'type must be research or infrastructure');
  need(m.status === 'complete', 'submission must be complete for acceptance (drafts are intentionally not eligible)');
  const agents = Array.isArray(m.agents) ? m.agents : [];
  need(agents.length > 0 && agents.filter(a => a.role === 'lead').length === 1, 'exactly one lead agent is required');
  need(new Set(agents.map(a => a.id)).size === agents.length, 'agent ids must be unique');
  need(m.subagentCount === agents.length - 1, 'subagentCount must equal agents minus the lead');
  for (const a of agents) {
    need(a.provider === policy.eligibleProvider && policy.eligibleModels.includes(a.modelName), `${a.id}: ineligible provider/model; only ${policy.eligibleModels.join(' or ')}`);
    for (const k of ['id', 'role', 'modelId', 'runtime', 'runtimeVersion', 'sessionId', 'reasoningEffort', 'thinkingMode']) need(nonempty(a[k]), `${a.id}: missing ${k}`);
    need(a.thinkingBudgetTokens === null || Number.isSafeInteger(a.thinkingBudgetTokens) && a.thinkingBudgetTokens >= 0, `${a.id}: invalid thinkingBudgetTokens`);
    for (const k of METRICS) need(a.metrics?.[k] === null || typeof a.metrics?.[k] === 'number' && Number.isFinite(a.metrics[k]) && a.metrics[k] >= 0 && (k === 'costUsd' || Number.isSafeInteger(a.metrics[k])), `${a.id}: invalid metric ${k}`);
    if (a.thinkingBudgetTokens === null || METRICS.some(k => a.metrics?.[k] === null)) need(nonempty(a.unavailableReason), `${a.id}: explain unavailable metrics/settings`);
  }
  const usage = m.usage ?? {};
  const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v));
  need(iso(usage.startedAt) && iso(usage.finishedAt), 'usage requires ISO startedAt and finishedAt');
  const seconds = (Date.parse(usage.finishedAt) - Date.parse(usage.startedAt)) / 1000;
  need(seconds >= 0 && Number.isInteger(usage.wallSeconds) && Math.abs(seconds - usage.wallSeconds) <= 2, 'wallSeconds must match elapsed timestamps');
  for (const k of METRICS) {
    const vals = agents.map(a => a.metrics?.[k]);
    if (vals.some(v => v === null)) need(usage[k] === null, `aggregate ${k} must be null when any agent metric is unavailable`);
    else need(typeof usage[k] === 'number' && Number.isFinite(usage[k]) && Math.abs(usage[k] - vals.reduce((a, b) => a + b, 0)) < 0.000001, `aggregate ${k} must equal the agent sum`);
  }
  if (METRICS.some(k => usage[k] === null)) need(nonempty(usage.unavailableReason), 'explain unavailable usage metrics; never substitute zero');
  file(usage.measurementSource, 'usage measurementSource');
  need(nonempty(m.provenance?.statement), 'provenance statement required');
  need(nonempty(m.provenance?.limitations), 'state provenance limitations (self-report is not proof)');
  need(Array.isArray(m.provenance?.evidenceFiles) && m.provenance.evidenceFiles.length > 0, 'runtime/model evidence files required');
  for (const p of m.provenance?.evidenceFiles ?? []) file(p, 'provenance evidence');
  need(nonempty(m.changes), 'describe the changes');
  need(m.completeness?.overallPercent === 100, 'complete submissions must declare 100% of the contracted scope');
  need(Array.isArray(m.completeness?.remainingGaps) && m.completeness.remainingGaps.length === 0, 'unresolved scope gaps must be addressed before acceptance');
  need(Array.isArray(m.validation) && m.validation.length > 0, 'record validation commands, outcomes, and logs');
  for (const v of m.validation ?? []) { need(nonempty(v.command) && v.result === 'passed', 'each validation needs a command and passed result'); file(v.log, 'validation log'); }
  need(m.payout?.method === 'arrange-after-acceptance' && nonempty(m.payout?.contact), 'payout requires arrange-after-acceptance and a public contact handle');
  if (m.type === 'infrastructure') need(m.bountyId === null && m.scope === null && m.research === null, 'infrastructure must not claim a research bounty');
  if (m.type === 'research') {
    need(!!bounty, 'unknown bountyId');
    if (bounty) {
      need(['open', 'claimed', 'in-review'].includes(bounty.status), 'bounty is not accepting submissions');
      for (const k of ['author', 'work', 'unit', 'citationScheme']) need(m.scope?.[k] === bounty[k], `scope.${k} must match the bounty`);
    }
    for (const k of ['coverageFile', 'sourcesFile', 'candidatesFile', 'categoriesFile']) file(m.research?.[k], k);
    const audits = m.research?.audits ?? [];
    need(Array.isArray(audits), 'audits must be an array');
    if (Array.isArray(audits)) {
      for (const k of policy.requiredAudits) need(audits.some(a => a.kind === k), `missing ${k} audit`);
      for (const a of audits) {
        need(agents.some(x => x.id === a.agentId), 'audit agentId is unknown');
        need(['independent-agent', 'separate-pass'].includes(a.method), 'audit must be an independent agent or explicitly separate pass');
        if (a.method === 'independent-agent') need(agents.some(x => x.id === a.agentId && x.role !== 'lead'), 'independent audit cannot be the lead agent');
        need(a.result === 'passed' && Number.isInteger(a.issuesFound) && a.issuesFound >= 0 && a.issuesFound === a.issuesResolved, 'audit must pass and resolve all reported issues');
        file(a.report, 'audit report');
      }
    }
  }
  return errors;
}

export function renderPR(m, bounty) {
  const lead = m.agents.find(a => a.role === 'lead');
  const unavailable = v => v === null ? 'Unavailable (see manifest)' : v;
  return `<!-- greek-index-bounty: submissions/${m.submissionId}.json -->
# ${bounty?.label ?? 'Infrastructure contribution'}

${m.changes || 'Describe the completed work.'}

${bounty?.issue ? `Bounty: ${bounty.issue}\n` : ''}
| Disclosure | Reported value |
| --- | --- |
| Status | ${m.status}; ${m.completeness.overallPercent}% of contracted scope |
| Lead model | ${lead?.provider} · ${lead?.modelName} · ${lead?.modelId} |
| Runtime | ${lead?.runtime} ${lead?.runtimeVersion} |
| Reasoning / thinking | ${lead?.reasoningEffort} / ${lead?.thinkingMode} |
| Subagents | ${m.subagentCount} (full roster in manifest) |
| Elapsed wall seconds | ${unavailable(m.usage.wallSeconds)} |
${METRICS.map(k => `| ${k} | ${unavailable(m.usage[k])} |`).join('\n')}
| Translated lines | ${m.completeness.translatedLines} |
| Analyzed tokens | ${m.completeness.analyzedTokens} |
| Reviewed lines | ${m.completeness.reviewedLines} |
| Remaining gaps | ${m.completeness.remainingGaps.length} |

## Evidence and limitations
${m.provenance.statement}

${m.provenance.limitations}

Evidence: ${m.provenance.evidenceFiles.map(p => `[${p}](${p})`).join(', ')}

The machine-readable manifest is the authoritative disclosure. These are contributor declarations; CI does not authenticate model identity or judge scholarship.

## Validation
${m.validation.map(v => `- ${v.command}: ${v.result} ([log](${v.log}))`).join('\n')}

## Acceptance
- [ ] Maintainer verified model/runtime evidence and source access.
- [ ] Maintainer reviewed Greek, translation, lexicon, articles, and audit reports.
- [ ] Bounty acceptance and payment recorded separately after review and merge.
`;
}
