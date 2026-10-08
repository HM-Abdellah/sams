import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.SAMS_BASE_URL || 'http://127.0.0.1:8080/sams/'
const ADMIN_CODE = process.env.SAMS_E2E_ADMIN_SAMS_CODE
const ADMIN_PASSWORD = process.env.SAMS_E2E_PASSWORD
const TEACHER_CODE = process.env.SAMS_E2E_TEACHER_SAMS_CODE
const TEACHER_PASSWORD = process.env.SAMS_E2E_TEACHER_PASSWORD

const audit = {
  startedAt: new Date().toISOString(),
  baseUrl: BASE,
  browser: null,
  pages: [],
  links: [],
  api: [],
  boundaries: [],
  responsive: [],
  totals: {
    pages: 0,
    pageFailures: 0,
    consoleErrors: 0,
    pageErrors: 0,
    failedRequests: 0,
    httpErrors: 0,
    axeViolations: 0,
    axeColorContrastViolations: 0,
    axeIncomplete: 0,
    domIssues: 0,
    responsiveIssues: 0,
  },
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
}

function ensureDirs() {
  mkdirSync('artifacts/deep-audit/screenshots', { recursive: true })
}

function redactUrl(url) {
  try {
    const parsed = new URL(url)
    for (const key of ['token', 'csrf_token', 'code', 'password', 'sams_code']) parsed.searchParams.delete(key)
    return parsed.toString()
  } catch {
    return url
  }
}

async function login(page, code, password) {
  if (!code || !password) throw new Error('Deep audit credentials are missing.')
  await page.goto('login')
  await page.getByLabel('SAMS Code').fill(code)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app\/(?:admin\/dashboard|teacher)$/)
}

async function domInspection(page) {
  return page.evaluate(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect()
      const style = window.getComputedStyle(el)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const name = (el) => (
      el.getAttribute('aria-label')?.trim()
      || el.getAttribute('title')?.trim()
      || el.textContent?.replace(/\s+/g, ' ').trim()
      || ''
    )

    const counts = {}
    for (const el of document.querySelectorAll('[id]')) counts[el.id] = (counts[el.id] || 0) + 1

    const unnamedButtons = [...document.querySelectorAll('button')].filter((el) => visible(el) && !name(el)).slice(0, 50)
      .map((el) => el.outerHTML.slice(0, 300))
    const unnamedLinks = [...document.querySelectorAll('a[href]')].filter((el) => visible(el) && !name(el)).slice(0, 50)
      .map((el) => el.outerHTML.slice(0, 300))
    const unlabeledFields = [...document.querySelectorAll('input, textarea, select')].filter((el) => {
      if (!visible(el) || el.type === 'hidden') return false
      const id = el.id
      const associated = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null
      const wrappingLabel = el.closest('label')
      return !associated && !wrappingLabel && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')
    }).slice(0, 50).map((el) => el.outerHTML.slice(0, 300))
    const imagesWithoutAlt = [...document.images].filter((img) => visible(img) && !img.hasAttribute('alt')).slice(0, 50)
      .map((img) => img.outerHTML.slice(0, 300))

    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) || '',
    }))
    const headingJumps = []
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i].level - headings[i - 1].level > 1) headingJumps.push({ from: headings[i - 1], to: headings[i] })
    }

    const landmarks = [...document.querySelectorAll('main,nav,header,footer,aside')].filter(visible).map((el) => ({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
    }))

    const internalLinks = [...document.querySelectorAll('a[href]')]
      .map((el) => el.href)
      .filter((href) => href.startsWith(location.origin))
      .map((href) => {
        const parsed = new URL(href)
        return parsed.pathname + parsed.search
      })
      .filter((href, i, arr) => arr.indexOf(href) === i)

    return {
      title: document.title,
      lang: document.documentElement.lang,
      dir: document.documentElement.dir,
      headingCount: headings.length,
      headings,
      headingJumps,
      landmarks,
      duplicateIds: Object.entries(counts).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count })),
      unnamedButtons,
      unnamedLinks,
      unlabeledFields,
      imagesWithoutAlt,
      internalLinks,
      bodyTextLength: document.body?.innerText?.length || 0,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body?.scrollWidth || 0,
      viewportWidth: window.innerWidth,
    }
  })
}

async function axeScan(page) {
  const general = await new AxeBuilder({ page }).analyze()
  const contrast = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()

  const serialize = (results) => results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.slice(0, 10).map((n) => ({
      target: n.target,
      html: n.html?.slice(0, 400),
      failureSummary: n.failureSummary,
    })),
  }))

  return {
    violations: serialize(general),
    colorContrastViolations: serialize(contrast),
    incomplete: general.incomplete.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 10).map((n) => ({
        target: n.target,
        html: n.html?.slice(0, 400),
        failureSummary: n.failureSummary,
      })),
    })),
  }
}

async function auditPage(page, context) {
  ensureDirs()
  const consoleEntries = []
  const pageErrors = []
  const failedRequests = []
  const httpErrors = []
  const onConsole = (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleEntries.push({ type: message.type(), text: message.text().slice(0, 1000), location: message.location() })
    }
  }
  const onPageError = (error) => pageErrors.push({ message: String(error.message || error).slice(0, 1200), stack: error.stack?.slice(0, 2000) || null })
  const onRequestFailed = (request) => failedRequests.push({ method: request.method(), url: redactUrl(request.url()), failure: request.failure() })
  const onResponse = (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ status: response.status(), method: response.request().method(), url: redactUrl(response.url()) })
    }
  }

  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)

  const started = Date.now()
  let navigation = null
  try {
    navigation = await page.goto(context.route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    const dom = await domInspection(page)
    const axe = await axeScan(page)
    const screenshot = 'artifacts/deep-audit/screenshots/' + slug(context.key) + '.png'
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0]
      const resources = performance.getEntriesByType('resource')
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd ?? null,
        loadEventEnd: nav?.loadEventEnd ?? null,
        resourceCount: resources.length,
        transferSize: resources.reduce((sum, item) => sum + (item.transferSize || 0), 0),
        slowestResources: resources.map((item) => ({
          name: item.name,
          duration: Math.round(item.duration),
          transferSize: item.transferSize || 0,
        })).sort((a, b) => b.duration - a.duration).slice(0, 10),
      }
    })

    const domIssues = [
      ...dom.duplicateIds.map((issue) => ({ kind: 'duplicate-id', detail: issue })),
      ...dom.unnamedButtons.map((html) => ({ kind: 'unnamed-button', detail: html })),
      ...dom.unnamedLinks.map((html) => ({ kind: 'unnamed-link', detail: html })),
      ...dom.unlabeledFields.map((html) => ({ kind: 'unlabeled-field', detail: html })),
      ...dom.imagesWithoutAlt.map((html) => ({ kind: 'image-without-alt', detail: html })),
      ...dom.headingJumps.map((jump) => ({ kind: 'heading-level-jump', detail: jump })),
    ]
    const overflow = dom.scrollWidth > dom.viewportWidth || dom.bodyScrollWidth > dom.viewportWidth

    audit.pages.push({
      key: context.key,
      area: context.area,
      role: context.role,
      route: context.route,
      durationMs: Date.now() - started,
      navigationStatus: navigation?.status() ?? null,
      finalUrl: page.url(),
      title: dom.title,
      lang: dom.lang,
      dir: dom.dir,
      metrics: {
        headingCount: dom.headingCount,
        internalLinks: dom.internalLinks.length,
        resourceCount: timing.resourceCount,
        transferSize: timing.transferSize,
        slowestResources: timing.slowestResources,
        bodyTextLength: dom.bodyTextLength,
      },
      screenshot,
      overflow,
      consoleErrors: consoleEntries,
      pageErrors,
      failedRequests,
      httpErrors,
      axeViolations: axe.violations,
      axeColorContrastViolations: axe.colorContrastViolations,
      axeIncomplete: axe.incomplete,
      domIssues,
    })

    audit.links.push(...dom.internalLinks.map((href) => ({ source: context.key, href })))
    audit.totals.pages += 1
    audit.totals.consoleErrors += consoleEntries.length
    audit.totals.pageErrors += pageErrors.length
    audit.totals.failedRequests += failedRequests.length
    audit.totals.httpErrors += httpErrors.length
    audit.totals.axeViolations += axe.violations.length
    audit.totals.axeColorContrastViolations += axe.colorContrastViolations.length
    audit.totals.axeIncomplete += axe.incomplete.length
    audit.totals.domIssues += domIssues.length

    if (context.expectFinalPath && !new RegExp(context.expectFinalPath).test(page.url())) {
      audit.boundaries.push({ key: context.key, result: 'FAIL', expected: context.expectFinalPath, actual: page.url() })
    }
  } catch (error) {
    const fatal = String(error?.stack || error)
    audit.pages.push({
      key: context.key,
      area: context.area,
      role: context.role,
      route: context.route,
      durationMs: Date.now() - started,
      navigationStatus: navigation?.status() ?? null,
      finalUrl: page.url(),
      fatalError: fatal,
      consoleErrors: consoleEntries,
      pageErrors,
      failedRequests,
      httpErrors,
    })
    audit.totals.pages += 1
    audit.totals.pageFailures += 1
    audit.totals.consoleErrors += consoleEntries.length
    audit.totals.pageErrors += pageErrors.length
    audit.totals.failedRequests += failedRequests.length
    audit.totals.httpErrors += httpErrors.length
  } finally {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
  }
}

async function auditResponsive(page, context, widths) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : width <= 768 ? 1024 : 900 })
    await page.goto(context.route, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {})
    const metrics = await page.evaluate(() => {
      const viewport = window.innerWidth
      const candidates = [...document.querySelectorAll('body *')].map((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: typeof el.className === 'string' ? el.className.slice(0, 240) : null,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          overflowX: style.overflowX,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }
      }).filter((item) => item.right > viewport + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 1)
        .sort((a, b) => Math.max(b.right - viewport, -b.left) - Math.max(a.right - viewport, -a.left))
        .slice(0, 12)
      return {
        viewport,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        overflowCandidates: candidates,
      }
    })
    const overflow = metrics.documentWidth > metrics.viewport || metrics.bodyWidth > metrics.viewport
    const name = slug(context.key + '-' + width)
    const screenshot = 'artifacts/deep-audit/screenshots/' + name + '.png'
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
    audit.responsive.push({ key: context.key, width, overflow, metrics, screenshot })
    if (overflow) audit.totals.responsiveIssues += 1
  }
}

async function auditLinks(page) {
  const unique = [...new Map(audit.links.map((item) => [item.href, item])).values()]
    .filter((item) => !item.checked)
    .slice(0, 300)

  const concurrency = 8
  for (let i = 0; i < unique.length; i += concurrency) {
    await Promise.all(unique.slice(i, i + concurrency).map(async (item) => {
      try {
        const response = await page.request.get(item.href, { maxRedirects: 5, timeout: 10000 })
        item.checked = true
        item.status = response.status()
      } catch (error) {
        item.checked = true
        item.error = String(error).slice(0, 800)
      }
    }))
  }
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function metricCard(label, value) {
  return '<div class="card"><strong>' + escapeHtml(label) + '</strong><div class="value">' + escapeHtml(String(value)) + '</div></div>'
}

function writeReport() {
  ensureDirs()
  audit.finishedAt = new Date().toISOString()
  audit.browser = { project: process.env.PLAYWRIGHT_TEST_PROJECT || 'chromium', node: process.version }
  writeFileSync('artifacts/deep-audit/report.json', JSON.stringify(audit, null, 2))

  const pageRows = audit.pages.map((p) => {
    const status = p.fatalError ? 'FAIL' : (p.httpErrors?.length || p.pageErrors?.length ? 'WARN' : 'PASS')
    return '<tr><td>' + escapeHtml(p.key) + '</td><td>' + status + '</td><td>' +
      escapeHtml(String(p.navigationStatus ?? '')) + '</td><td>' +
      escapeHtml(String(p.httpErrors?.length || 0)) + '</td><td>' +
      escapeHtml(String(p.pageErrors?.length || 0)) + '</td><td>' +
      escapeHtml(String(p.axeViolations?.length || 0)) + '</td><td>' +
      escapeHtml(String(p.axeColorContrastViolations?.length || 0)) + '</td><td>' +
      escapeHtml(String(p.axeIncomplete?.length || 0)) + '</td><td>' +
      escapeHtml(String(p.domIssues?.length || 0)) + '</td><td>' +
      '<a href="screenshots/' + slug(p.key) + '.png">screenshot</a></td></tr>'
  }).join('')

  const responsiveRows = audit.responsive.map((item) =>
    '<tr><td>' + escapeHtml(item.key) + '</td><td>' + item.width + '</td><td>' +
    (item.overflow ? '<strong class="fail">FAIL</strong>' : 'PASS') + '</td><td>' +
    item.metrics.documentWidth + ' / ' + item.metrics.viewport + '</td><td>' +
    '<a href="screenshots/' + slug(item.key + '-' + item.width) + '.png">screenshot</a></td></tr>'
  ).join('')

  const boundaryRows = audit.boundaries.map((item) =>
    '<tr><td>' + escapeHtml(item.key) + '</td><td>' + escapeHtml(item.result) + '</td><td>' +
    escapeHtml(item.expected || '') + '</td><td>' + escapeHtml(item.actual || '') + '</td></tr>'
  ).join('')

  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>SAMS Deep Product Audit</title><style>' +
    'body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}' +
    'table{border-collapse:collapse;width:100%;margin:16px 0 32px}' +
    'th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}' +
    'th{background:#f2f2f2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}' +
    '.card{border:1px solid #ddd;border-radius:10px;padding:12px}.value{font-size:24px}' +
    '.fail{color:#b00020}' +
    '</style></head><body>' +
    '<h1>SAMS Deep Product Audit</h1>' +
    '<p><strong>Started:</strong> ' + escapeHtml(audit.startedAt) + '<br><strong>Finished:</strong> ' +
    escapeHtml(audit.finishedAt) + '<br><strong>Base URL:</strong> ' + escapeHtml(audit.baseUrl) + '</p>' +
    '<div class="grid">' +
    metricCard('Pages', audit.totals.pages) +
    metricCard('Page failures', audit.totals.pageFailures) +
    metricCard('HTTP errors', audit.totals.httpErrors) +
    metricCard('Console errors/warnings', audit.totals.consoleErrors) +
    metricCard('Page errors', audit.totals.pageErrors) +
    metricCard('Failed requests', audit.totals.failedRequests) +
    metricCard('Axe violations', audit.totals.axeViolations) +
    metricCard('Axe incomplete', audit.totals.axeIncomplete) +
    metricCard('DOM issues', audit.totals.domIssues) +
    metricCard('Responsive issues', audit.totals.responsiveIssues) +
    '</div>' +
    '<h2>Page audit</h2><table><thead><tr><th>Page</th><th>Result</th><th>HTTP</th><th>HTTP errors</th><th>JS errors</th><th>Axe</th><th>Contrast</th><th>Axe incomplete</th><th>DOM</th><th>Evidence</th></tr></thead><tbody>' +
    pageRows + '</tbody></table>' +
    '<h2>Responsive audit</h2><table><thead><tr><th>Page</th><th>Width</th><th>Overflow</th><th>Document / viewport</th><th>Evidence</th></tr></thead><tbody>' +
    responsiveRows + '</tbody></table>' +
    '<h2>Route boundaries</h2><table><thead><tr><th>Check</th><th>Result</th><th>Expected</th><th>Actual</th></tr></thead><tbody>' +
    boundaryRows + '</tbody></table>' +
    '<h2>Raw evidence</h2><p>See <code>report.json</code> for full machine-readable details. Playwright HTML report and traces are stored beside this report.</p>' +
    '</body></html>'

  writeFileSync('artifacts/deep-audit/report.html', html)
}

const publicRoutes = [
  { key: 'public-login', area: 'Public', role: 'guest', route: 'login' },
  { key: 'public-onboarding', area: 'Public', role: 'guest', route: 'onboarding' },
  { key: 'public-onboarding-status', area: 'Public', role: 'guest', route: 'onboarding/status' },
  { key: 'public-onboarding-activate', area: 'Public', role: 'guest', route: 'onboarding/activate' },
]

const adminRoutes = [
  'app/admin/dashboard',
  'app/admin/classes',
  'app/admin/students',
  'app/admin/teachers',
  'app/admin/users',
  'app/admin/onboarding',
  'app/admin/academic-years',
  'app/admin/imports',
  'app/admin/archive',
  'app/admin/audit',
].map((route) => ({ key: 'admin-' + route.split('/').at(-1), area: 'Admin', role: 'admin', route }))

const teacherRoutes = [
  'app/teacher',
  'app/attendance',
  'app/classes',
  'app/students',
  'app/signatures',
  'app/reports',
].map((route) => ({ key: 'teacher-' + route.split('/').at(-1), area: 'Teacher', role: 'teacher', route }))

test.describe.configure({ mode: 'serial' })

test.describe('SAMS Deep Product Audit', () => {
  test.beforeAll(() => {
    ensureDirs()
    if (!ADMIN_CODE || !ADMIN_PASSWORD || !TEACHER_CODE || !TEACHER_PASSWORD) {
      throw new Error('Deep audit requires all four synthetic E2E credential environment variables.')
    }
  })

  test('01 Public route and shell audit', async ({ page }) => {
    for (const route of publicRoutes) await auditPage(page, route)
  })

  test('02 Admin route matrix', async ({ page }) => {
    await login(page, ADMIN_CODE, ADMIN_PASSWORD)
    for (const route of adminRoutes) await auditPage(page, route)
  })

  test('03 Teacher route matrix', async ({ page }) => {
    await login(page, TEACHER_CODE, TEACHER_PASSWORD)
    for (const route of teacherRoutes) await auditPage(page, route)

    await page.goto('app/classes')
    const classLink = page.locator('a[href*="/app/classes/"]').first()
    if (await classLink.count()) {
      const href = await classLink.getAttribute('href')
      if (href) {
        await auditPage(page, {
          key: 'teacher-class-detail',
          area: 'Teacher',
          role: 'teacher',
          route: href.replace(/^.*\/sams\//, ''),
        })
      }
    }
  })

  test('04 Role boundaries and API security smoke', async ({ page, browser }) => {
    const guestContext = await browser.newContext({ baseURL: BASE })
    const guestPage = await guestContext.newPage()
    await guestPage.goto('app/teacher')
    await guestPage.waitForURL(/\/login$/, { timeout: 5000 }).catch(() => {})
    audit.boundaries.push({
      key: 'guest-protected-route',
      result: /\/login$/.test(guestPage.url()) ? 'PASS' : 'FAIL',
      expected: '/login',
      actual: guestPage.url(),
    })

    const teacherContext = await browser.newContext({ baseURL: BASE })
    const teacherPage = await teacherContext.newPage()
    await login(teacherPage, TEACHER_CODE, TEACHER_PASSWORD)
    await teacherPage.goto('app/admin/dashboard')
    await teacherPage.waitForURL(/\/unauthorized$/, { timeout: 5000 }).catch(() => {})
    audit.boundaries.push({
      key: 'teacher-admin-route',
      result: /\/unauthorized$/.test(teacherPage.url()) ? 'PASS' : 'FAIL',
      expected: '/unauthorized',
      actual: teacherPage.url(),
    })

    const adminContext = await browser.newContext({ baseURL: BASE })
    const adminPage = await adminContext.newPage()
    await login(adminPage, ADMIN_CODE, ADMIN_PASSWORD)
    const health = await adminPage.request.get('api/v1/health')
    audit.api.push({ key: 'health', status: health.status(), headers: health.headers() })
    const adminData = await adminPage.request.get('api/v1/admin/dashboard')
    audit.api.push({ key: 'authenticated-admin-dashboard', status: adminData.status() })
    const guestData = await guestPage.request.get('api/v1/admin/dashboard')
    audit.api.push({ key: 'unauthenticated-admin-dashboard', status: guestData.status() })

    await guestContext.close()
    await teacherContext.close()
    await adminContext.close()
  })

  test('05 Responsive, RTL, link and resource audit', async ({ browser }) => {
    test.setTimeout(180000)
    const adminContext = await browser.newContext({ baseURL: BASE })
    const adminPage = await adminContext.newPage()
    await login(adminPage, ADMIN_CODE, ADMIN_PASSWORD)

    const responsiveWidths = [320, 375, 768, 1024, 1440]
    for (const route of adminRoutes) {
      await auditResponsive(adminPage, route, responsiveWidths)
    }

    const teacherContext = await browser.newContext({ baseURL: BASE })
    const teacherPage = await teacherContext.newPage()
    await login(teacherPage, TEACHER_CODE, TEACHER_PASSWORD)

    for (const route of teacherRoutes) {
      await auditResponsive(teacherPage, route, responsiveWidths)
    }

    await teacherPage.goto('app/classes')
    const classLink = teacherPage.locator('a[href*="/app/classes/"]').first()
    if (await classLink.count()) {
      const href = await classLink.getAttribute('href')
      if (href) {
        await auditResponsive(teacherPage, {
          key: 'teacher-class-detail',
          area: 'Teacher',
          role: 'teacher',
          route: href.replace(/^.*\/sams\//, ''),
        }, responsiveWidths)
      }
    }

    await teacherPage.goto('app/attendance')
    const lang = teacherPage.locator('#sams-language')
    if (await lang.count()) {
      await lang.selectOption('ar')
      await teacherPage.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {})
      const rtl = await teacherPage.evaluate(() => ({
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }))
      const rtlScreenshot = 'artifacts/deep-audit/screenshots/teacher-attendance-rtl-390.png'
      await teacherPage.setViewportSize({ width: 390, height: 844 })
      await teacherPage.screenshot({ path: rtlScreenshot, fullPage: true, animations: 'disabled' })
      audit.responsive.push({ key: 'teacher-attendance-rtl', width: 390, overflow: rtl.overflow, metrics: rtl, screenshot: rtlScreenshot })
      if (rtl.overflow) audit.totals.responsiveIssues += 1
      if (rtl.lang !== 'ar' || rtl.dir !== 'rtl') {
        audit.boundaries.push({ key: 'rtl-document-contract', result: 'FAIL', expected: 'lang=ar and dir=rtl', actual: 'lang=' + rtl.lang + ', dir=' + rtl.dir })
      }
    }

    await auditLinks(adminPage)
    await auditLinks(teacherPage)
    await adminContext.close()
    await teacherContext.close()
  })

  test.afterAll(() => {
    audit.links = audit.links.filter((item, index, arr) => index === arr.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)))
    writeReport()
    console.log('=== SAMS DEEP AUDIT REPORT ===')
    console.log(JSON.stringify(audit.totals, null, 2))
    console.log('Human report: artifacts/deep-audit/report.html')
  })
})

