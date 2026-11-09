/** Dependency-free Chrome smoke tests. Uses its own profile, backend, and temporary DB.
 * Start the frontend first; see README. Requires Node 24 and a local Chrome binary.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = process.env.TRACKER_PREVIEW_URL || 'http://127.0.0.1:43127';
const frontendApi = process.env.TRACKER_PREVIEW_API || 'http://127.0.0.1:43128';
for (const url of [frontend, frontendApi]) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Browser checks only target explicit local preview addresses.');
}
const chromeCandidates = process.platform === 'darwin'
  ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  : process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(dir => path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  : (process.env.PATH || '').split(path.delimiter).flatMap(dir => ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].map(name => path.join(dir, name)));
const chromePath = process.env.TRACKER_CHROME_PATH || chromeCandidates.find(candidate => fs.existsSync(candidate));
if (!chromePath) throw new Error('Chrome was not found. Install Chrome or set TRACKER_CHROME_PATH.');
const python = process.env.TRACKER_TEST_PYTHON || 'python3';
const artifactParent = process.env.TRACKER_ARTIFACTS_PARENT || os.tmpdir();
fs.mkdirSync(artifactParent, { recursive: true });
const artifacts = fs.mkdtempSync(path.join(artifactParent, 'tracker-browser-check-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = net.createServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const testPort = server.address().port;
await new Promise(resolve => server.close(resolve));
const testApi = `http://127.0.0.1:${testPort}`;
const backend = spawn(python, ['-B', path.join(root, 'backend/run_tracker.py'), '--database', path.join(artifacts, 'test.sqlite3'), '--port', String(testPort), '--frontend-origin', frontend, '--seed-demo', '--review-mode', 'mock'], { cwd: root, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', OPENAI_API_KEY: '', TZ: 'America/Los_Angeles' }, stdio: ['ignore', 'pipe', 'pipe'] });
let backendLog = ''; backend.stdout.on('data', chunk => backendLog += chunk); backend.stderr.on('data', chunk => backendLog += chunk);
backend.on('error', error => backendLog += error.message);
let chrome, ws;
const results = [], browserErrors = [], blockedExternal = [], hydrationWarnings = [];
let mode = 'normal', serial = 0, cancelledInterceptions = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++serial;
  const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
  pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function until(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(`!!document.body && (${expression})`)) return; await sleep(200); }
  throw new Error(`Timed out: ${expression}`);
}
function check(name, passed) { results.push({ name, passed: !!passed }); if (!passed) throw new Error(name); }
async function navigate(route, ready) { await send('Page.navigate', { url: frontend + route }); await until(ready); }
async function click(text) {
  await evaluate(`(()=>{const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!button)throw new Error('Button not found');button.click();})()`);
  await sleep(80);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});let parent=input.parentElement;while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}input.focus();input.select();})()`);
  await send('Input.insertText', { text: value });
}
async function select(selector, value) {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function rows() { return (await fetch(testApi + '/applications')).json(); }
async function intercept(params) {
  const { requestId, request } = params;
  const url = new URL(request.url);
  if (request.url.startsWith(frontendApi + '/')) {
    const isList = url.pathname === '/applications' && request.method === 'GET';
    const isWrite = ['POST', 'PUT'].includes(request.method);
    if (mode === 'offline' && isWrite) { mode = 'normal'; return send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' }); }
    if (mode === 'lost-response' && isWrite) {
      mode = 'normal';
      const saved = await fetch(testApi + url.pathname, { method: request.method, headers: { 'Content-Type': 'application/json', ...(request.headers['X-Request-ID'] ? { 'X-Request-ID': request.headers['X-Request-ID'] } : {}) }, body: request.postData });
      if (!saved.ok) throw new Error('Lost-response setup failed');
      return send('Fetch.failRequest', { requestId, errorReason: 'ConnectionFailed' });
    }
    if ((mode === 'validation' && isWrite) || (mode === 'unavailable' && isWrite) || (mode === 'load-error' && isList) || (mode === 'empty' && isList)) {
      const kind = mode; if (isWrite) mode = 'normal';
      const status = kind === 'empty' ? 200 : kind === 'validation' ? 422 : 503;
      const body = kind === 'empty' ? [] : { error: { message: kind === 'validation' ? 'Check the highlighted fields.' : 'The database is temporarily unavailable. Please try again.', fields: kind === 'validation' ? { role: 'Synthetic validation rejection. Keep the role and retry.' } : {} } };
      return send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: frontend }], body: Buffer.from(JSON.stringify(body)).toString('base64') });
    }
    return send('Fetch.continueRequest', { requestId, url: testApi + url.pathname + url.search });
  }
  if (url.origin !== frontend) { blockedExternal.push(url.origin); return send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }); }
  return send('Fetch.continueRequest', { requestId });
}

try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(testApi + '/health'); if (response.ok) { ready = true; break; } } catch { /* waiting for our own process */ }
    await sleep(200);
  }
  if (!ready) throw new Error('Isolated backend did not start: ' + backendLog);
  const profile = path.join(artifacts, 'chrome-profile');
  chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1, EXCLUDE localhost', 'about:blank'], { stdio: 'ignore' });
  chrome.on('error', error => browserErrors.push(error.message));
  const activePort = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 75 && !fs.existsSync(activePort); i++) await sleep(200);
  const port = fs.readFileSync(activePort, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const promise = pending.get(message.id); if (!promise) return; pending.delete(message.id); message.error ? promise.reject(new Error(JSON.stringify(message.error))) : promise.resolve(message.result); }
    else if (message.method === 'Fetch.requestPaused') intercept(message.params).catch(error => {
      // Navigating cancels in-flight requests before a queued CDP continuation.
      // This protocol cancellation is not a browser/runtime failure.
      if (error.message.includes('Invalid InterceptionId.')) cancelledInterceptions++;
      else browserErrors.push(error.message);
    });
    else if (message.method === 'Runtime.consoleAPICalled' && /hydrat|didn't match/i.test(JSON.stringify(message.params.args))) hydrationWarnings.push(JSON.stringify(message.params.args));
    else if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  };
  await send('Page.enable'); await send('Page.bringToFront'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__downloads = [];
    const blobs = new Map();
    const originalCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = originalCreate(blob); blobs.set(url, blob); return url; };
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download && blobs.has(this.href)) {
        const entry = { name: this.download, content: null }; window.__downloads.push(entry);
        blobs.get(this.href).text().then(content => entry.content = content);
        return;
      }
      return originalClick.call(this);
    };
  ` });

  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*', requestStage: 'Request' }] });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await navigate('/', 'document.querySelectorAll(".stat-card").length===3');
  check('dashboard explains the four-item follow-up limit', await evaluate('document.querySelector(".follow-up-panel").innerText.includes("Showing 4 of 5 follow-ups")'));
  check('dashboard counts applications', await evaluate('document.querySelector(".stat-card strong").innerText==="6"'));
  await screenshot('01-dashboard');
  await navigate('/applications', 'document.querySelectorAll("tbody tr").length===6');
  await fill('#search-applications', 'Northstar'); await until('document.querySelectorAll("tbody tr").length===1');
  check('singular export scope is grammatical', await evaluate('document.querySelector("#export-scope").selectedOptions[0].textContent.includes("1 record") && !document.querySelector("#export-scope").selectedOptions[0].textContent.includes("1 records")'));
  check('search filters company', await evaluate('document.querySelector("tbody").innerText.includes("Northstar")'));
  await click('Export applications CSV'); await until('typeof window.__downloads.at(-1)?.content==="string"');
  check('CSV filtered scope exports only matching current application', await evaluate('window.__downloads.at(-1).name.includes("current-filtered") && window.__downloads.at(-1).content.includes("Northstar") && !window.__downloads.at(-1).content.includes("Fern & Field")'));
  await select('#export-scope', 'all'); await click('Export applications CSV'); await until('typeof window.__downloads.at(-1)?.content==="string"');
  check('CSV all scope ignores filters and announces scope', await evaluate('window.__downloads.at(-1).name.includes("all-including-archived") && window.__downloads.at(-1).content.includes("Fern & Field") && document.body.innerText.includes("filters ignored")'));
  await select('#export-scope', 'view');

  await click('Clear filters'); await select('#filter-status', 'Applied'); await until('document.querySelectorAll("tbody tr").length===2');
  check('status filter', true); await click('Clear filters'); await select('#sort-applications', 'company');
  await until('document.querySelector("tbody tr").innerText.includes("Common Ground")'); check('company sorting', true);
  await select('#sort-applications', 'follow_up'); await until('document.querySelector("tbody tr").innerText.includes("Fern & Field")'); check('follow-up sorting', true);
  await screenshot('02-applications');
  await navigate('/applications/new', 'document.querySelector("#application-company")!==null'); await sleep(400);
  check('all form controls have associated labels', await evaluate('Array.from(document.querySelectorAll("input,select,textarea")).every(el=>el.labels.length>0)'));
  await click('Save application'); await until('document.querySelector("#company-error")!==null');
  check('required-field error moves focus', await evaluate('document.activeElement.id==="application-company"'));
  await fill('#application-company', 'Browser Synthetic Co'); await fill('#application-role', 'Quality Engineer');
  await fill('#application-job_link', 'javascript:invalid');
  await evaluate('document.querySelector(".tracking-options").open=false');
  await click('Save application'); await until('document.querySelector("#job_link-error")!==null');
  check('invalid optional field reopens its disclosure and preserves focus/input', await evaluate('document.querySelector(".tracking-options").open && document.activeElement.id==="application-job_link" && document.activeElement.value==="javascript:invalid"'));
  await fill('#application-job_link', '');
  mode = 'validation'; await click('Save application'); await until('document.body.innerText.includes("Synthetic validation rejection")');
  check('422 preserves fields and exposes field error', await evaluate('document.querySelector("#application-role").value==="Quality Engineer"&&document.querySelector("#application-role").getAttribute("aria-invalid")==="true"'));
  mode = 'offline'; await click('Save application'); await until('document.body.innerText.includes("Cannot reach the tracker")');
  check('connection failure preserves inputs', await evaluate('document.querySelector("#application-company").value==="Browser Synthetic Co"'));
  await screenshot('03-preserved-inputs');
  mode = 'lost-response'; await click('Save application'); await until('document.body.innerText.includes("Cannot reach the tracker")');
  await until('document.querySelector("button[type=submit]").disabled===false');
  // The server saved it, but the browser did not receive that response.
  check('lost response saved exactly once', (await rows()).length === 7);
  await click('Save application'); await until('document.body.innerText.includes("Application saved.")');
  check('retry does not duplicate application', (await rows()).length === 7);
  const newRecord = (await rows()).find(item => item.company === 'Browser Synthetic Co');
  await until('document.querySelector(".activity-timeline")!==null');
  check('new application has no missing-history warning', await evaluate('document.querySelector(".activity-panel").innerText.includes("Application created") && !document.querySelector(".history-note")'));
  await screenshot('04-details');
  await click('Edit details'); await until('document.activeElement.id==="application-company"'); check('edit focuses the first field', true);
  await fill('#application-notes', 'Synthetic notes survive failure.'); await select('#application-status', 'Interviewing');
  mode = 'unavailable'; await click('Save changes'); await until('document.body.innerText.includes("database is temporarily unavailable")');
  check('503 preserves edit inputs', await evaluate('document.querySelector("#application-notes").value==="Synthetic notes survive failure."'));
  await click('Save changes'); await until('document.body.innerText.includes("Changes saved.")');
  check('edits keep ID and application count', (await rows()).length === 7 && (await rows()).find(item => item.id === newRecord.id).status === 'Interviewing');
  await click('Archive'); await until('document.querySelector("dialog").open');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await until('!document.querySelector("dialog").open'); check('archive dialog dismisses with Escape', true);
  await click('Archive'); await click('Archive application'); await until('document.body.innerText.includes("Application archived.")');
  await navigate('/', 'document.querySelectorAll(".stat-card").length===3'); check('archived record excluded from dashboard', await evaluate('document.querySelector(".stat-card strong").innerText==="6"'));
  await navigate('/applications', 'document.querySelectorAll("tbody tr").length===6');
  await evaluate('Array.from(document.querySelectorAll(".list-scope button")).find(b=>b.textContent.includes("Archived")).click()'); await until('document.querySelectorAll("tbody tr").length===1'); check('archived record remains discoverable', true);
  await click('Export applications CSV'); await until('typeof window.__downloads.at(-1)?.content==="string"');
  check('archived CSV scope exports the archived record only', await evaluate('window.__downloads.at(-1).name.includes("archived-filtered") && window.__downloads.at(-1).content.includes("Browser Synthetic Co") && !window.__downloads.at(-1).content.includes("Northstar")'));
  await navigate(`/applications/${newRecord.id}`, 'document.body.innerText.includes("Restore application")'); await click('Restore application'); await until('document.body.innerText.includes("Application restored")');
  check('restore preserves record', (await rows()).find(item => item.id === newRecord.id).archived_at === null);
  await until('document.querySelector(".activity-timeline")!==null');
  check('activity shows persisted creation status archive and restore', await evaluate('["Application created", "Status: Interested → Interviewing", "Application archived", "Application restored"].every(t=>document.querySelector(".activity-timeline").innerText.includes(t))'));

  // Full persisted review flow, entirely inside the isolated test database and mock provider.
  const syntheticResume = 'University project\nBuilt a React and TypeScript course planner with labeled forms and keyboard navigation.\nWrote Python scripts to clean sample datasets.';
  const syntheticJob = 'Required: React and TypeScript interface development.\nRequired: two years of professional software development.\nPreferred: Docker experience.\nAccessible forms and keyboard navigation.';
  const workspace = async () => (await fetch(`${testApi}/applications/${newRecord.id}/workspace`)).json();
  for (const [kind, text] of [['resume', syntheticResume], ['job', syntheticJob]]) {
    await until('document.querySelector("#document-editor")!==null');
    await evaluate('document.querySelector("#document-editor").open=true');
    await select('#document-kind', kind); await fill('#document-label', `Browser synthetic ${kind}`); await fill('#document-text', text);
    if (kind === 'resume') {
      mode = 'offline'; await click('Save document version'); await until('document.body.innerText.includes("Your text is kept here")');
      check('document failure preserves pasted text', await evaluate('document.querySelector("#document-text").value.startsWith("University project")'));
    }
    await click('Save document version'); await until('document.querySelector("#document-editor") && !document.querySelector("#document-editor").open && document.activeElement.matches(".version-item > summary")');
  }
  check('saved document announces success and focuses its version', await evaluate('document.body.innerText.includes("Version saved.") && document.activeElement.matches(".version-item > summary")'));
  check('required document name and singular versions are clear', await evaluate('document.querySelector("label[for=document-label]").textContent.includes("Required") && document.querySelector(".document-summary").innerText.includes("1 saved version") && !document.querySelector(".document-summary").innerText.includes("1 saved versions")'));
  check('two immutable input versions saved', (await workspace()).documents.length === 2);
  await navigate(`/applications/${newRecord.id}/review`, 'document.querySelector("#review-consent")!==null');
  check('review does not run on load', (await workspace()).reviews.length === 0);
  check('review inputs have accessible labels', await evaluate('Array.from(document.querySelectorAll("input,select,textarea")).every(el=>el.labels.length>0)'));
  await evaluate('document.querySelector("#review-consent").click()');
  mode = 'lost-response'; await click('Request mock review'); await until('document.body.innerText.includes("Check the saved request before")');
  await click('Check saved request'); await until('document.querySelector(".saved-review-grid")!==null');
  check('review lost response recovers exactly one saved run', (await workspace()).reviews.length === 1);
  const savedReview = (await workspace()).reviews[0];
  check('saved result leads with evidence and hides request details', await evaluate('!document.querySelector(".review-request").open && document.querySelector(".review-steps").innerText.includes("Evidence")'));
  check('mock provenance and unknown model usage are honest', savedReview.mode === 'mock' && savedReview.model_returned === null && savedReview.usage === null);
  await evaluate('document.querySelector(".saved-requirement").open=true; document.querySelectorAll(".evidence-link")[1].click()');
  await until('document.querySelector(".source-passage.highlighted")!==null && document.activeElement.id==="saved-source"');
  check('source citation highlights exact original passage and moves keyboard focus', await evaluate('document.activeElement.id==="saved-source" && document.querySelector(".source-passage.highlighted").innerText.includes("course planner")'));
  await screenshot('09-saved-review');
  await fill('#answer-q1', 'I did not measure any usability outcomes.'); mode = 'offline'; await click('Save answer');
  await until('document.querySelector(".clarification-form .form-error")!==null');
  check('failed clarification preserves answer', await evaluate('document.querySelector("#answer-q1").value.includes("did not measure")'));
  await click('Save answer'); await until('document.body.innerText.includes("Answer saved as a user-supplied claim")');
  await evaluate('document.querySelector(".revision-item input[type=checkbox]").click()');
  await click('Accept proposed wording'); await until('document.body.innerText.includes("Saved decision: accept")');
  await click('Reject suggestion'); await until('document.body.innerText.includes("Saved decision: reject")');
  check('reject disables applying the suggestion', await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Apply accepted revisions as new version").disabled'));
  await fill('#revision-v1', 'Developed a React and TypeScript course planner with labeled forms and keyboard navigation.');
  await evaluate('document.querySelector(".revision-item input[type=checkbox]").click()');
  await click('Save my edited wording'); await until('document.body.innerText.includes("Saved decision: edit")');
  mode = 'lost-response'; await click('Apply accepted revisions as new version'); await until('document.body.innerText.includes("Cannot reach the tracker")');
  await click('Apply accepted revisions as new version'); await until('document.body.innerText.includes("New résumé version saved")');
  const revisedWorkspace = await workspace();
  check('apply retries create exactly one revised version', revisedWorkspace.documents.length === 3);
  check('original version immutable after decisions', revisedWorkspace.documents.find(d=>d.id===savedReview.resume_id).text===syntheticResume);
  check('answer plus accept reject edit history persisted', revisedWorkspace.reviews[0].events.length === 4);
  await screenshot('10-saved-decisions');
  await navigate(`/applications/${newRecord.id}/review?run=${savedReview.id}`, 'document.body.innerText.includes("Saved decision: edit")');
  check('reopened review retains answer and decisions', await evaluate('document.querySelector("#answer-q1").value.includes("did not measure")'));
  check('reopen has no new model request', (await workspace()).reviews.length === 1);
  check('reopening a review selects its original input versions', await evaluate(`document.querySelector('#select-resume').value===${JSON.stringify(savedReview.resume_id)} && document.querySelector('#select-job').value===${JSON.stringify(savedReview.job_id)}`));

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  check('saved review mobile has no page overflow', await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await screenshot('11-mobile-saved-review');
  await navigate(`/applications/${newRecord.id}`, 'document.querySelector(".activity-timeline")!==null && document.querySelectorAll(".version-item").length===3');
  check('details timeline and export controls fit on mobile', await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await click('Show all 9 events');
  check('timeline includes saved review outcome and exactly one revision application', await evaluate('document.querySelector(".activity-timeline").innerText.includes("Mock review completed") && document.querySelectorAll(".activity-timeline li").length===9'));
  await evaluate(`document.querySelector('#version-${savedReview.resume_id}').open=true; document.querySelector('#version-${savedReview.resume_id}').parentElement.open=true;`);
  await evaluate(`Array.from(document.querySelector('#version-${savedReview.resume_id}').querySelectorAll('button')).find(b=>b.textContent==='Download résumé text').click()`);
  await until('typeof window.__downloads.at(-1)?.content==="string"');
  check('selected original résumé downloads exact text without metadata', await evaluate(`window.__downloads.at(-1).content===${JSON.stringify(syntheticResume)} && window.__downloads.at(-1).name.endsWith('.txt')`));
  await screenshot('12-mobile-activity');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  const badDoc = await (await fetch(`${testApi}/applications/${newRecord.id}/documents`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),kind:'resume',label:'Synthetic unsupported fixture',text:'A different synthetic résumé.'})})).json();
  const failure = await (await fetch(`${testApi}/applications/${newRecord.id}/reviews`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),resume_id:badDoc.id,job_id:savedReview.job_id,expected_mode:'mock',expected_model:null})})).json();
  await navigate(`/applications/${newRecord.id}/review?run=${failure.id}`, 'document.body.innerText.includes("Review failed")');
  check('known mock failure states no charge and has one retry action', await evaluate('document.body.innerText.includes("No AI call or charge occurred") && !document.body.innerText.includes("may already have been charged") && Array.from(document.querySelectorAll("button")).filter(b=>b.textContent==="Start a new attempt").length===1'));
  await screenshot('13-mock-failure');
  await navigate('/review', 'document.querySelectorAll(".requirement-button").length===4'); await sleep(300);
  await evaluate('document.querySelectorAll(".requirement-button")[2].click()'); await until('document.body.innerText.includes("No supporting passage")');
  check('not-evidenced clears source highlight', await evaluate('document.querySelectorAll(".highlighted").length===0'));
  await evaluate('document.querySelectorAll(".requirement-button")[0].click()'); await until('document.querySelectorAll(".highlighted").length===1');
  await screenshot('05-review-preview');
  await evaluate('document.querySelector(".suggestion-card details").open=true'); await click('Try selecting this suggestion'); await until('document.body.innerText.includes("Selected in this preview only")');
  check('preview selection is explicitly unsaved', (await rows()).length === 7);
  await navigate('/baseline', 'document.body.innerText.includes("Live baseline requests are disabled")'); check('baseline disabled by default', true);
  mode = 'empty'; await navigate('/applications', 'document.body.innerText.includes("Make room for your next opportunity")'); check('empty state', true); await screenshot('06-empty-state');
  mode = 'load-error'; await navigate('/applications', 'document.body.innerText.includes("We couldn’t load this view")'); check('load failure is not shown as empty data', await evaluate('!document.body.innerText.includes("Make room for your next opportunity")'));
  mode = 'normal'; await click('Try again'); await until('document.querySelectorAll("tbody tr").length===7'); check('load retry recovers', true);
  await navigate('/applications/00000000-0000-0000-0000-000000000000', 'document.body.innerText.includes("This application was not found")'); check('missing record has recovery link', await evaluate('document.body.innerText.includes("Back to applications")'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  for (const [route, ready] of [['/', 'document.querySelectorAll(".stat-card").length===3'], ['/applications', 'document.querySelectorAll("tbody tr").length===7'], ['/applications/new', 'document.querySelector("#application-company")!==null'], ['/review', 'document.querySelectorAll(".requirement-button").length===4']]) {
    await navigate(route, ready); check(`mobile has no page overflow: ${route}`, await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if (route === '/') await screenshot('07-mobile-dashboard');
    if (route === '/applications/new') await screenshot('08-mobile-form');
  }
  check('no external requests', blockedExternal.length === 0);
  check('no hydration warnings in extension-free browser', hydrationWarnings.length === 0);
  check('no browser runtime exceptions', browserErrors.length === 0);
  console.log(JSON.stringify({ passed: results.length, results, artifacts }, null, 2));
} catch (error) {
  if (ws?.readyState === WebSocket.OPEN) { try { await screenshot('failure'); console.error(await evaluate('JSON.stringify({active:document.activeElement?.outerHTML.slice(0,300),source:document.querySelector("#saved-source")?.outerHTML.slice(0,150),highlight:document.querySelector(".source-passage.highlighted")?.innerText,body:document.body.innerText.slice(0,2500)})'));  } catch { /* preserve original failure */ } }
  console.error(error); console.error({ browserErrors, artifacts }); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify({ results, browserErrors, blockedExternal, hydrationWarnings, cancelledInterceptions }, null, 2));
  ws?.close(); chrome?.kill('SIGTERM'); backend.kill('SIGTERM');
  await sleep(500);
}
