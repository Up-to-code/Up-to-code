import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "Up-to-code";
const token = process.env.GITHUB_TOKEN;
const outputDirectory = path.resolve("generated");
const featuredRepositories = ["Kyna", "roshn-reit", "qentrah-whatsapp", "similarweb-clone"];

const knownColors = {
  Astro: "#ff5a03",
  C: "#555555",
  "C#": "#178600",
  "C++": "#f34b7d",
  CSS: "#663399",
  Dart: "#00b4ab",
  Go: "#00add8",
  HTML: "#e34c26",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  Kotlin: "#a97bff",
  PHP: "#4f5d95",
  PowerShell: "#012456",
  Python: "#3572a5",
  Ruby: "#701516",
  Rust: "#dea584",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Svelte: "#ff3e00",
  Swift: "#f05138",
  TypeScript: "#3178c6",
  Vue: "#41b883",
};

async function github(endpoint) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${owner}-profile-readme`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${endpoint}: ${await response.text()}`);
  }
  return response.json();
}

async function getOwnedRepositories() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await github(`/users/${owner}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
    repositories.push(...batch.filter((repository) => !repository.fork && !repository.archived));
    if (batch.length < 100) return repositories;
  }
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function colorFor(language) {
  if (knownColors[language]) return knownColors[language];
  let hash = 0;
  for (const character of language) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 68% 56%)`;
}

function percentage(bytes, total) {
  const value = (bytes / total) * 100;
  return value < 0.01 ? "&lt;0.01%" : `${value.toFixed(2)}%`;
}

function languageChart(languages, repositoryCount, updatedAt) {
  const total = languages.reduce((sum, language) => sum + language.bytes, 0);
  const columns = 3;
  const rows = Math.ceil(languages.length / columns);
  const height = 214 + rows * 31;
  const chartX = 48;
  const chartWidth = 864;
  let x = chartX;
  const segments = languages.map((language, index) => {
    const exactWidth = (language.bytes / total) * chartWidth;
    const width = index === languages.length - 1 ? chartX + chartWidth - x : exactWidth;
    const segment = `<rect x="${x.toFixed(2)}" y="126" width="${Math.max(width, 0.5).toFixed(2)}" height="22" fill="${colorFor(language.name)}" />`;
    x += exactWidth;
    return segment;
  }).join("\n    ");

  const columnWidth = 288;
  const legend = languages.map((language, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    const itemX = 48 + column * columnWidth;
    const itemY = 188 + row * 31;
    return `<g transform="translate(${itemX} ${itemY})">
      <circle cx="6" cy="-5" r="6" fill="${colorFor(language.name)}" />
      <text class="label" x="20" y="0">${escapeXml(language.name)}</text>
      <text class="value" x="266" y="0" text-anchor="end">${percentage(language.bytes, total)}</text>
    </g>`;
  }).join("\n    ");

  return `<svg width="960" height="${height}" viewBox="0 0 960 ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">Languages across ${owner}'s repositories</title>
  <desc id="desc">Automatically generated language percentages for ${languages.length} languages across ${repositoryCount} original public repositories.</desc>
  <style>
    .surface { fill: #0d1117; }
    .border { stroke: #30363d; }
    .heading { fill: #f0f6fc; }
    .label { fill: #c9d1d9; font: 600 13px ui-sans-serif, system-ui, sans-serif; }
    .value { fill: #8b949e; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .muted { fill: #8b949e; }
    @media (prefers-color-scheme: light) {
      .surface { fill: #ffffff; }
      .border { stroke: #d0d7de; }
      .heading { fill: #1f2328; }
      .label { fill: #24292f; }
      .value, .muted { fill: #57606a; }
    }
  </style>
  <rect class="surface" x="1" y="1" width="958" height="${height - 2}" rx="16" />
  <rect class="border" x="1" y="1" width="958" height="${height - 2}" rx="16" fill="none" />
  <text class="heading" x="48" y="55" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22" font-weight="750">The code behind the products</text>
  <text class="muted" x="48" y="82" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13">${repositoryCount} original public repositories · ${languages.length} languages · updated ${updatedAt}</text>
  <rect x="48" y="126" width="864" height="22" rx="11" fill="#21262d" />
  <clipPath id="bar"><rect x="48" y="126" width="864" height="22" rx="11" /></clipPath>
  <g clip-path="url(#bar)">
    ${segments}
  </g>
  ${legend}
</svg>`;
}

function wrapText(value, maxLength = 54, maxLines = 2) {
  const words = (value || "A project by Ahmed Mansour.").trim().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  const sourceWasCut = lines.join(" ").length < (value || "").trim().length;
  if (sourceWasCut && lines.length) lines[lines.length - 1] = `${lines.at(-1).replace(/[.,;:]?$/, "")}…`;
  return lines.slice(0, maxLines);
}

function projectCard(repository, languageBytes) {
  const primaryLanguage = Object.entries(languageBytes).sort((a, b) => b[1] - a[1])[0]?.[0] || repository.language || "Code";
  const descriptionLines = wrapText(repository.description);
  const textLines = descriptionLines.map((line, index) => `<text class="muted" x="30" y="${82 + index * 20}">${escapeXml(line)}</text>`).join("\n  ");
  const repositoryName = repository.name === "roshn-reit" ? "ROSHN REIT" : repository.name;
  const accent = colorFor(primaryLanguage);

  return `<svg width="460" height="168" viewBox="0 0 460 168" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(repositoryName)}</title>
  <desc id="desc">${escapeXml(repository.description || `The ${repositoryName} repository`)}</desc>
  <style>
    .surface { fill: #0d1117; }
    .border { stroke: #30363d; }
    .title { fill: #f0f6fc; font: 700 17px ui-sans-serif, system-ui, sans-serif; }
    .muted { fill: #8b949e; font: 13px ui-sans-serif, system-ui, sans-serif; }
    .meta { fill: #c9d1d9; font: 600 12px ui-sans-serif, system-ui, sans-serif; }
    .shine { animation: shine 4.5s ease-in-out infinite; }
    @keyframes shine { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    @media (prefers-color-scheme: light) {
      .surface { fill: #ffffff; }
      .border { stroke: #d0d7de; }
      .title { fill: #1f2328; }
      .muted { fill: #57606a; }
      .meta { fill: #24292f; }
    }
  </style>
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="460" y2="0">
      <stop stop-color="${accent}" />
      <stop offset="1" stop-color="#8b5cf6" />
    </linearGradient>
  </defs>
  <rect class="surface" x="1" y="1" width="458" height="166" rx="14" />
  <rect class="border" x="1" y="1" width="458" height="166" rx="14" fill="none" />
  <rect class="shine" x="1" y="1" width="458" height="4" rx="2" fill="url(#accent)" />
  <path d="M31 34.5a5.5 5.5 0 0 1 5.5-5.5h10a5.5 5.5 0 0 1 5.5 5.5v13a5.5 5.5 0 0 1-5.5 5.5h-10a5.5 5.5 0 0 1-5.5-5.5v-13Z" fill="none" stroke="${accent}" stroke-width="1.5" />
  <path d="M36 29v24" stroke="${accent}" stroke-width="1.5" />
  <text class="title" x="64" y="47">${escapeXml(repositoryName)}</text>
  ${textLines}
  <circle cx="34" cy="142" r="5" fill="${accent}" />
  <text class="meta" x="47" y="146">${escapeXml(primaryLanguage)}</text>
  <text class="meta" x="410" y="146" text-anchor="end">★ ${repository.stargazers_count}</text>
  <path d="M425 139h9m0 0-4-4m4 4-4 4" stroke="${accent}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const repositories = await getOwnedRepositories();
  const languageResults = await mapWithConcurrency(repositories, 8, (repository) => github(`/repos/${owner}/${repository.name}/languages`));
  const totals = new Map();
  languageResults.forEach((languages) => {
    Object.entries(languages).forEach(([name, bytes]) => totals.set(name, (totals.get(name) || 0) + bytes));
  });
  const languages = [...totals.entries()]
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
  const updatedAt = new Date().toISOString().slice(0, 10);

  await writeFile(path.join(outputDirectory, "languages.svg"), languageChart(languages, repositories.length, updatedAt));
  await writeFile(path.join(outputDirectory, "languages.json"), `${JSON.stringify({ owner, updatedAt, repositoryCount: repositories.length, languages }, null, 2)}\n`);

  for (const repositoryName of featuredRepositories) {
    const repository = await github(`/repos/${owner}/${repositoryName}`);
    const languageBytes = await github(`/repos/${owner}/${repositoryName}/languages`);
    await writeFile(path.join(outputDirectory, `project-${repositoryName.toLowerCase()}.svg`), projectCard(repository, languageBytes));
  }

  console.log(`Generated profile assets for ${repositories.length} repositories and ${languages.length} languages.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
