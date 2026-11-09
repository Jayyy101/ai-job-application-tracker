/** Record an actual synthetic browser workflow as an MP4, preserving real pauses.
 * Requires the running local frontend, Node 24, Chrome, Python and TRACKER_FFMPEG.
 * Own backend/database/profile; outbound browser requests blocked. No provider calls.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
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
const artifactParent = process.env.TRACKER_ARTIFACTS_PARENT || path.join(root, 'artifacts/walkthrough');
if (!/^[a-z0-9-]+$/.test(process.env.RECORDING_LABEL || 'before')) throw new Error('Use a simple recording label.');
if (fs.existsSync(path.join(artifactParent, `${process.env.RECORDING_LABEL || 'before'}-walkthrough.mp4`))) throw new Error('Video already exists. Choose a new RECORDING_LABEL or artifact directory; existing recordings are preserved.');
if (!process.env.TRACKER_FFMPEG || !fs.existsSync(process.env.TRACKER_FFMPEG)) throw new Error('Set TRACKER_FFMPEG to an installed encoder executable.');
fs.mkdirSync(artifactParent, { recursive: true });
const artifacts = fs.mkdtempSync(path.join(artifactParent, `${process.env.RECORDING_LABEL || 'before'}-session-`));
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
let recording = false, frameSerial = 0, started = 0; const frames = [], chapters = [];
const label = process.env.RECORDING_LABEL || 'before';
const movie = path.join(artifactParent, `${label}-walkthrough.mp4`);
const browserErrors = [], blockedExternal = [], hydrationWarnings = [];
let serial = 0, cancelledInterceptions = 0;
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
async function navigate(route, ready) { await send('Page.navigate', { url: frontend + route }); await until(ready); }
async function point(expression) {
  await evaluate(`(()=>{const el=${expression};if(!el)throw new Error('Control missing');let p=el.tagName==='SUMMARY'?el.parentElement.parentElement:el.parentElement;while(p){if(p instanceof HTMLDetailsElement)p.open=true;p=p.parentElement;}el.scrollIntoView({block:'center',behavior:'instant'});})()`);
  await sleep(350);
  const rect = await evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',...rect}); await sleep(200);
  await send('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...rect});
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...rect}); await sleep(450);
}
async function click(text) { await point(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})`); }
async function control(selector) { await point(`document.querySelector(${JSON.stringify(selector)})`); }
async function show(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`); await sleep(700); }
async function chapter(title, selector, pause=3500) {
  if(selector) await show(selector);
  chapters.push({seconds: Math.round(Date.now()/1000-started), title});
  await screenshot(String(chapters.length).padStart(2,'0')+'-'+title.toLowerCase().replace(/[^a-z0-9]+/g,'-')); await sleep(pause);
}
async function fill(selector, value) {
  await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.select();})()`);
  await send('Input.insertText', { text: value });
}
async function select(selector, value) {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
}
async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(artifacts, `${name}.png`), Buffer.from(shot.data, 'base64'));
}
async function rows() { return (await fetch(testApi + '/applications')).json(); }
async function intercept(params) {
  const { requestId, request } = params;
  const url = new URL(request.url);
  if (request.url.startsWith(frontendApi + '/')) {
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
    else if (message.method === 'Page.screencastFrame') {
      const p = message.params; send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(()=>{});
      if (recording) { const file = `frame-${String(++frameSerial).padStart(6, '0')}.jpg`; fs.writeFileSync(path.join(artifacts, file), Buffer.from(p.data, 'base64')); frames.push({file, at: Date.now() / 1000}); }
    }
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
  await send('Browser.setDownloadBehavior', {behavior:'allow',downloadPath:path.join(artifacts,'downloads')});
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http*', requestStage: 'Request' }] });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/', 'document.querySelectorAll(".stat-card").length===3');
  recording = true; started=Date.now()/1000;
  await send('Page.startScreencast', {format:'jpeg',quality:92,maxWidth:1440,maxHeight:1000,everyNthFrame:1});
  await chapter('Dashboard', null, 4500);
  await point(`Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/applications/new')`);
  await until('document.querySelector("#application-company")!==null');
  await fill('#application-company', 'Cedar Studio · synthetic'); await fill('#application-role', 'Frontend Developer');
  await chapter('Create an application', '#application-company');
  await click('Save application'); await until('document.body.innerText.includes("Application saved.")');
  const app = (await rows()).find(a=>a.company==='Cedar Studio · synthetic');
  const workspace = async ()=>(await fetch(`${testApi}/applications/${app.id}/workspace`)).json();
  await chapter('Saved without AI', '.detail-header');
  await click('Edit details'); await fill('#application-role','Frontend Engineer'); await select('#application-status','Applied');
  await control('#application-next_action'); await fill('#application-next_action','Send a short follow-up to the hiring team');
  await evaluate(`(()=>{const el=document.querySelector('#application-follow_up_date');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'2026-11-12');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await chapter('Edit and set a follow-up', '#application-next_action');
  await click('Save changes'); await until('document.body.innerText.includes("Changes saved.")');
  await chapter('Tracking details saved', '.detail-grid');
  await click('Archive'); await until('document.querySelector("dialog").open'); await chapter('Archive confirmation', 'dialog', 2500);
  await click('Archive application'); await until('document.body.innerText.includes("Application archived.")'); await chapter('Archived application', '.detail-header');
  await click('Restore application'); await until('document.body.innerText.includes("Application restored")'); await chapter('Restore and persisted activity', '.activity-panel');
  const resume='University project\nBuilt a React and TypeScript course planner with labeled forms and keyboard navigation.\nWrote Python scripts to clean sample datasets.';
  const job='Required: React and TypeScript interface development.\nRequired: two years of professional software development.\nPreferred: Docker experience.\nAccessible forms and keyboard navigation.';
  for(const [kind,text] of [['resume',resume],['job',job]]) {
    await control('#document-editor > summary'); await select('#document-kind',kind);
    await fill('#document-label',kind==='resume'?'Original project résumé':'Frontend role posting'); await fill('#document-text',text);
    await chapter(kind==='resume'?'Save résumé text':'Save job description','#document-text',4500);
    await click('Save document version'); await until('document.querySelector("#document-editor") && !document.querySelector("#document-editor").open && document.activeElement.matches(".version-item > summary")');
  }
  await chapter('Saved document versions','.documents-panel');
  await point(`Array.from(document.querySelectorAll('a')).find(a=>a.textContent.trim()==='Open review workspace')`);
  await until('document.querySelector("#review-consent")!==null');
  await chapter('Labeled mock review request','#review-consent',4500); await control('#review-consent'); await click('Request mock review');
  await until('document.querySelector(".saved-review-grid")!==null');
  const run=(await workspace()).reviews[0];
  await chapter('Saved mock result','.review-intro',5500);
  await control('.saved-requirement > summary');
  await point(`document.querySelectorAll('.saved-requirement .evidence-link')[1]`);
  await until('document.querySelector(".source-passage.highlighted")!==null');
  await chapter('Requirement and exact supporting passage','.saved-review-grid',6500);
  await control('#answer-q1'); await fill('#answer-q1','I did not measure usability outcomes. I can describe the keyboard navigation, but have no metric.');
  await chapter('Clarification without invented metrics','#answer-q1',4500);
  await click('Save answer'); await until('document.body.innerText.includes("Answer saved as a user-supplied claim")');
  await chapter('Compare original and suggested wording','.revision-item',6500);
  await control('.revision-item input[type=checkbox]'); await click('Accept proposed wording'); await until('document.body.innerText.includes("Saved decision: accept")');
  await chapter('Saved revision decision','.revision-item',4500);
  await click('Apply accepted revisions as new version'); await until('document.body.innerText.includes("New résumé version saved")');
  await chapter('Applied as a new version','.revision-item',4500);
  await point(`Array.from(document.querySelectorAll('summary')).find(s=>s.textContent.startsWith('Answer & decision history'))`);
  await chapter('Persisted answer and decision history','.history-event',4500);
  await point(`document.querySelector('.back-link')`);
  await until('document.querySelectorAll(".version-item").length===3');
  await chapter('Application activity after review','.activity-panel',4500);
  await point(`Array.from(document.querySelectorAll('summary')).find(s=>s.textContent.startsWith('Previous reviews'))`);
  await point(`document.querySelector('.history-link')`); await until('document.querySelector(".saved-review-grid")!==null');
  await chapter('Reopen saved review with original sources','.review-intro',4500);
  await point(`document.querySelector('.back-link')`); await until('document.querySelectorAll(".version-item").length===3');
  await control(`#version-${run.resume_id} > summary`); await chapter('Original résumé remains unchanged',`#version-${run.resume_id}`,5500);
  await point(`Array.from(document.querySelector('#version-${run.resume_id}').querySelectorAll('button')).find(b=>b.textContent==='Download résumé text')`);
  await chapter('Download selected résumé text',`#version-${run.resume_id}`,3000);
  await point(`Array.from(document.querySelectorAll('a')).find(a=>a.getAttribute('href')==='/applications')`); await until('document.querySelector("#search-applications")!==null');
  await fill('#search-applications','Cedar Studio'); await until('document.querySelectorAll("tbody tr").length===1');
  await chapter('Export scope follows the filtered list','#export-scope',4500); await click('Export applications CSV'); await sleep(3000);
  const savedApplication=(await rows()).find(a=>a.id===app.id); if(savedApplication.follow_up_date!=='2026-11-12'||savedApplication.archived_at||savedApplication.role!=='Frontend Engineer')throw new Error('Tracking changes did not persist');
  const docs=await workspace(); if(docs.documents.length!==3 || docs.documents.find(d=>d.id===run.resume_id).text!==resume || docs.reviews.length!==1 || docs.reviews[0].mode!=='mock') throw new Error('Recorded workflow invariant failed');
  const stop=Date.now()/1000; recording=false; await send('Page.stopScreencast');
  const downloads=fs.readdirSync(path.join(artifacts,'downloads'));
  if(!downloads.some(n=>n.endsWith('.txt'))||!downloads.some(n=>n.endsWith('.csv')))throw new Error('Browser downloads missing');
  if(fs.readFileSync(path.join(artifacts,'downloads',downloads.find(n=>n.endsWith('.txt'))),'utf8')!==resume)throw new Error('Downloaded original differs');
  if(browserErrors.length||blockedExternal.length||hydrationWarnings.length)throw new Error(JSON.stringify({browserErrors,blockedExternal}));
  const concat=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(0.001,(frames[i+1]?.at??stop)-f.at)}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(path.join(artifacts,'frames.txt'),concat);
  const ffmpeg=process.env.TRACKER_FFMPEG; if(!ffmpeg)throw new Error('Set TRACKER_FFMPEG to the local encoder');
  const encoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(artifacts,'frames.txt'),'-vf','fps=15,format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-movflags','+faststart',movie],{encoding:'utf8'});
  if(encoded.status!==0)throw new Error(encoded.stderr);
  const verified=spawnSync(ffmpeg,['-v','error','-i',movie,'-f','null','-'],{encoding:'utf8'}); if(verified.status!==0)throw new Error(verified.stderr);
  const manifest={label,movie,durationSeconds:stop-started,viewport:{width:1440,height:1000},chapters,applicationId:app.id,reviewId:run.id,artifacts,downloads,frames:frames.length,browserErrors,blockedExternal,hydrationWarnings,cancelledInterceptions};
  fs.writeFileSync(path.join(artifactParent,`${label}-index.json`),JSON.stringify(manifest,null,2));
  for(const frame of frames)fs.unlinkSync(path.join(artifacts,frame.file));
  console.log(JSON.stringify(manifest,null,2));
} catch(error) {
  if(ws?.readyState===WebSocket.OPEN) { try{await screenshot('failure');console.error(await evaluate('document.body.innerText.slice(0,3500)'));}catch{} }
  console.error(error); console.error({artifacts,browserErrors});process.exitCode=1;
} finally {
  ws?.close();chrome?.kill('SIGTERM');backend.kill('SIGTERM');await sleep(500);
}
