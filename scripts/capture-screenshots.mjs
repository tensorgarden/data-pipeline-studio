import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SCREENSHOT_URL || 'http://127.0.0.1:3108';
const outDir = path.resolve('docs/screenshots');

const captures = [
  {
    file: '01-alerts-dashboard.png',
    description: 'Alerts requiring attention with contract drift and SLO breaches',
    locator: ':has-text("Alerts Requiring Attention")'
  },
  {
    file: '02-pipeline-status.png',
    description: 'Pipeline status grid with active, running, and failed pipelines',
    locator: ':has-text("Pipeline Status")'
  },
  {
    file: '03-run-timeline-quality.png',
    description: 'Run timeline and data quality dashboard with check metrics',
    locator: ':has-text("Data Quality Dashboard")'
  },
  {
    file: '04-etl-scheduler.png',
    description: 'ETL job scheduler with batch and streaming job types',
    locator: ':has-text("ETL Job Scheduler")'
  },
  {
    file: '05-connector-health.png',
    description: 'Source connector health with latency and sync status',
    locator: ':has-text("Source Connector Health")'
  },
  {
    file: '06-full-dashboard.png',
    description: 'Full data pipeline studio dashboard with all metrics',
    locator: 'h1:has-text("Data Pipeline Studio")'
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
