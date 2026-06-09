import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SCREENSHOT_URL || 'http://127.0.0.1:3107';
const outDir = path.resolve('docs/screenshots');

const captures = [
  {
    file: '01-dashboard-hero.png',
    description: 'Landing/dashboard hero with active practice loop',
    locator: 'header'
  },
  {
    file: '02-candidate-workspace-session-builder.png',
    description: 'Candidate workspace, session builder, and coach/admin roles',
    locator: 'section:has-text("Candidate workspace")'
  },
  {
    file: '03-transcript-follow-up.png',
    description: 'Transcript and deterministic mock AI follow-up',
    locator: 'section:has-text("Transcript and mock AI follow-up")'
  },
  {
    file: '04-feedback-rubric-report.png',
    description: 'Rubric scoring and feedback report',
    locator: 'section:has-text("Rubric scoring and feedback report")'
  },
  {
    file: '05-admin-analytics.png',
    description: 'Admin progress dashboard and candidate progress timeline',
    locator: 'section:has-text("Admin progress dashboard")'
  },
  {
    file: '00-full-page.png',
    description: 'Full-page portfolio demo screenshot',
    fullPage: true
  }
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.emulateMedia({ colorScheme: 'light' });

const manifest = [];
for (const capture of captures) {
  const outputPath = path.join(outDir, capture.file);
  if (capture.fullPage) {
    await page.screenshot({ path: outputPath, fullPage: true });
  } else {
    const element = page.locator(capture.locator).first();
    await element.scrollIntoViewIfNeeded();
    await element.screenshot({ path: outputPath });
  }
  manifest.push({ file: `docs/screenshots/${capture.file}`, description: capture.description });
}

await browser.close();
console.log(JSON.stringify({ ok: true, baseUrl, screenshots: manifest }, null, 2));
