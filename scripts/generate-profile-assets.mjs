import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const owner = process.env.GITHUB_REPOSITORY_OWNER || "Up-to-code";
const token = process.env.GITHUB_TOKEN;

/** Keep these off language totals even if a token can see them. */
const hiddenRepositories = new Set([
  "lamerre",
  "alpha-app",
  "alpha-marketing",
  "qentrah-platform",
  "qentrah-edittor",
  "qentrah-studio",
  "qentrah-brand-assets",
  "qentrah-chat",
  "QentrahAi",
  "qentrah-whatsapp",
]);
const outputDirectory = path.resolve("generated");
const iconDirectory = path.join(outputDirectory, "icons");

const languageIcons = {
  Astro: "astro/astro-original.svg",
  C: "c/c-original.svg",
  "C++": "cplusplus/cplusplus-original.svg",
  CMake: "cmake/cmake-original.svg",
  CSS: "css3/css3-original.svg",
  Dart: "dart/dart-original.svg",
  Dockerfile: "docker/docker-original.svg",
  Go: "go/go-original.svg",
  HTML: "html5/html5-original.svg",
  Java: "java/java-original.svg",
  JavaScript: "javascript/javascript-original.svg",
  Kotlin: "kotlin/kotlin-original.svg",
  PowerShell: "powershell/powershell-original.svg",
  Python: "python/python-original.svg",
  Ruby: "ruby/ruby-original.svg",
  SCSS: "sass/sass-original.svg",
  Shell: "bash/bash-original.svg",
  Swift: "swift/swift-original.svg",
  TypeScript: "typescript/typescript-original.svg",
};

const knownColors = {
  Astro: "#ff5a03",
  C: "#555555",
  "C#": "#178600",
  "C++": "#f34b7d",
  CMake: "#da3434",
  CSS: "#663399",
  Dart: "#00b4ab",
  Dockerfile: "#384d54",
  Go: "#00add8",
  HTML: "#e34c26",
  Java: "#b07219",
  JavaScript: "#f1e05a",
  Kotlin: "#a97bff",
  Makefile: "#427819",
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
    repositories.push(...batch.filter((repository) => (
      !repository.fork
      && !repository.archived
      && !hiddenRepositories.has(repository.name)
      && !/qentrah/i.test(repository.name)
    )));
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

function colorFor(language) {
  if (knownColors[language]) return knownColors[language];
  let hash = 0;
  for (const character of language) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 62% 48%)`;
}

function formatPercentage(value) {
  return value < 0.01 ? "<0.01%" : `${value.toFixed(2)}%`;
}

function iconName(language) {
  if (language === "C++") return "cpp.svg";
  return `${language.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.svg`;
}

async function copyLanguageIcons(languages) {
  await rm(iconDirectory, { recursive: true, force: true });
  await mkdir(iconDirectory, { recursive: true });
  await Promise.all(languages.map(async ({ name }) => {
    const source = name === "Makefile"
      ? path.resolve("languages", "icons", "makefile.svg")
      : languageIcons[name]
        ? path.resolve("node_modules", "devicon", "icons", languageIcons[name])
        : path.resolve("languages", "icons", "code.svg");
    await copyFile(source, path.join(iconDirectory, iconName(name)));
  }));
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const [account, repositories] = await Promise.all([github(`/users/${owner}`), getOwnedRepositories()]);
  const languageResults = await mapWithConcurrency(repositories, 8, (repository) => github(`/repos/${owner}/${repository.name}/languages`));
  const totals = new Map();

  languageResults.forEach((languages) => {
    Object.entries(languages).forEach(([name, bytes]) => totals.set(name, (totals.get(name) || 0) + bytes));
  });

  const totalBytes = [...totals.values()].reduce((sum, bytes) => sum + bytes, 0);
  const updatedAt = new Date().toISOString().slice(0, 10);
  const profile = {
    owner,
    updatedAt,
    updatedLabel: new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${updatedAt}T00:00:00Z`)),
    repositoryCount: account.public_repos,
    languageRepositoryCount: repositories.length,
    languages: [...totals.entries()]
      .map(([name, bytes]) => {
        const percentage = (bytes / totalBytes) * 100;
        return { name, icon: `./icons/${iconName(name)}`, bytes, percentage, label: formatPercentage(percentage), color: colorFor(name) };
      })
      .sort((a, b) => b.bytes - a.bytes),
  };

  await copyLanguageIcons(profile.languages);

  const template = await readFile(path.resolve("languages", "index.html"), "utf8");
  const html = template.replace("__PROFILE_DATA__", JSON.stringify(profile).replaceAll("<", "\\u003c"));

  await writeFile(path.join(outputDirectory, "languages.json"), `${JSON.stringify(profile, null, 2)}\n`);
  await writeFile(path.join(outputDirectory, "languages.html"), html);
  console.log(`Generated HTML profile data for ${account.public_repos} public repositories; languages use ${repositories.length} original repositories.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
