#!/usr/bin/env node
/**
 * Checks the live model catalogue against src/app/models/published-scores.json
 * and reports what has no published figure behind it.
 *
 * Run it whenever a model is added. The models page plots a model only if this
 * data resolves for it, so a new checkpoint silently goes unplotted otherwise —
 * this is the thing that tells you, and names the exact JSON path to fill in.
 *
 * It reads the same JSON the app reads, patterns included, so the two cannot
 * drift apart. What it cannot do is find the numbers for you: benchmark figures
 * live in model cards and papers, and a score that is guessed rather than
 * quoted has no business on a customer-facing page. The script tells you which
 * model needs looking up; a person still reads the source.
 *
 *   npm run models:coverage -- --api https://api.example.com --token "$TOKEN"
 *   npm run models:coverage -- --file catalogue.json
 *   npm run models:coverage -- gemma3-4b qwen3-8b slp-orchestra-mini
 *
 * Exits 1 when something in the catalogue has no figure, so CI can hold the
 * line; --quiet reduces it to the gaps alone.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(HERE, '../src/app/models/published-scores.json');
const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'));

const SIZE_RE = new RegExp(data.sizePattern, 'i');
const REASONING_RE = new RegExp(data.reasoningPattern, 'i');
const FAMILIES = data.families.map((f) => ({ ...f, re: new RegExp(f.pattern, 'i') }));

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const fullName = (m) => `${m.name} ${m.display_name || ''}`;

const paramsOf = (m) => {
  const listed = data.paramOverrides[m.name];
  if (listed) return listed;
  for (const source of [m.name, m.display_name || '']) {
    const match = SIZE_RE.exec(source);
    if (match) return parseFloat(match[1]);
  }
  return null;
};

const familyOf = (m) => FAMILIES.find((f) => f.re.test(fullName(m))) ?? null;

function resolveModel(m) {
  const family = familyOf(m);
  const params = paramsOf(m);
  if (!family) return { status: 'no-family', params };
  if (params === null) return { status: 'no-size', family, params };
  const variants = family.sizes[String(params)];
  if (!variants) return { status: 'no-figure', family, params };
  const wantsReasoning = REASONING_RE.test(fullName(m));
  const figure =
    (wantsReasoning ? variants.reasoning : variants.standard) ??
    variants.standard ??
    variants.reasoning;
  if (!figure) return { status: 'no-figure', family, params };
  return { status: 'ok', family, params, figure, wantsReasoning };
}

async function loadCatalogue() {
  const file = flag('file');
  if (file) {
    const parsed = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.models || [];
  }

  const api = flag('api');
  if (api) {
    const token = flag('token') || process.env.SMARTLOOP_TOKEN;
    if (!token) {
      console.error('--api needs --token, or SMARTLOOP_TOKEN in the environment.');
      process.exit(2);
    }
    const res = await fetch(`${api.replace(/\/$/, '')}/models`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`GET ${api}/models failed: ${res.status} ${res.statusText}`);
      process.exit(2);
    }
    return res.json();
  }

  // Bare names on the command line — the quickest way to check one model.
  const names = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--api' && argv[argv.indexOf(a) - 1] !== '--token' && argv[argv.indexOf(a) - 1] !== '--file');
  if (names.length) return names.map((name) => ({ name, display_name: '' }));

  console.error('Nothing to check. Pass model names, --file <json>, or --api <url> --token <token>.');
  process.exit(2);
}

const catalogue = await loadCatalogue();
const rows = catalogue
  .filter((m) => m.access_level !== 'internal')
  .map((m) => ({ model: m, ...resolveModel(m) }));

const covered = rows.filter((r) => r.status === 'ok');
const gaps = rows.filter((r) => r.status !== 'ok');

if (!has('quiet')) {
  console.log(`\n${data.benchmark.name} coverage — ${covered.length}/${rows.length} models plotted\n`);
  const width = Math.max(...rows.map((r) => r.model.name.length), 5);
  for (const r of covered) {
    const mode = r.figure.mode ? ` · ${r.figure.mode}` : '';
    console.log(
      `  ok    ${r.model.name.padEnd(width)}  ${String(r.params).padStart(3)}B  ` +
        `${String(r.figure.score).padStart(5)}${mode.padEnd(12)}  ${r.family.source}`
    );
  }
}

if (gaps.length) {
  console.log(`\n${gaps.length} model${gaps.length > 1 ? 's' : ''} not plotted:\n`);
  for (const r of gaps) {
    const name = r.model.name;
    if (r.status === 'no-family') {
      console.log(`  ${name}\n    No family matches. Add one to "families" in published-scores.json`);
      console.log(`    with its name pattern and source, or leave it unplotted if nothing is published.`);
    } else if (r.status === 'no-size') {
      console.log(`  ${name}\n    Family ${r.family.key}, but no parameter count in the name.`);
      console.log(`    Add "paramOverrides": { "${name}": <billions> } if the size is known.`);
    } else {
      console.log(`  ${name}\n    Family ${r.family.key}, size ${r.params}B, but no figure at that size.`);
      console.log(`    Look up ${data.benchmark.name} in ${r.family.source} (${r.family.sourceUrl})`);
      console.log(`    then add families[${r.family.key}].sizes["${r.params}"] = { "standard": { "score": N, "mode": null } }`);
    }
    console.log('');
  }
  process.exit(1);
}

console.log('\nEvery model in the catalogue has a published figure.\n');
