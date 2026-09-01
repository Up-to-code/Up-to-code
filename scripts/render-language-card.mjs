import { execFile } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const htmlUrl = pathToFileURL(path.join(root, "generated", "languages.html")).href;
const frameRoot = path.join(root, ".profile-frames");
const frameCount = 46;
const heldFrames = 12;

async function renderTheme(page, theme) {
  const themeDirectory = path.join(frameRoot, theme);
  await mkdir(themeDirectory, { recursive: true });
  await page.goto(htmlUrl);

  for (let index = 0; index < frameCount + heldFrames; index += 1) {
    const progress = Math.min(1, index / (frameCount - 1));
    await page.evaluate(({ progress, theme }) => window.renderFrame(progress, theme), { progress, theme });
    await page.screenshot({
      path: path.join(themeDirectory, `frame-${String(index).padStart(3, "0")}.png`),
      animations: "disabled",
    });
  }

  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-framerate", "30",
    "-i", path.join(themeDirectory, "frame-%03d.png"),
    "-plays", "1",
    "-final_delay", "3/1",
    "-f", "apng",
    path.join(root, "generated", `languages-${theme}.png`),
  ]);
}

async function main() {
  await rm(frameRoot, { recursive: true, force: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { window.__PROFILE_CAPTURE__ = true; });

  try {
    await renderTheme(page, "light");
    await renderTheme(page, "dark");
  } finally {
    await browser.close();
    await rm(frameRoot, { recursive: true, force: true });
  }

  console.log("Rendered 1920×720 light and dark animated profile cards.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
