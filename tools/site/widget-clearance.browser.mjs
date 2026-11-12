// Local-only layout contract for JJ's closed launcher. This inert vendor-shape fixture
// reproduces the fixed shadow host and hidden panel space; actual CDN renders are
// checked separately. No vendor request, call, microphone access or CRM POST can run.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium} = createRequire(new URL('../contact-form/package.json', import.meta.url))('playwright');
const root = new URL('../../', import.meta.url);
const out = process.env.FPC_EVIDENCE_DIR || '/tmp/fpc-jj-clearance';
await mkdir(out, {recursive:true});
const fixture = `customElements.define('elevenlabs-convai', class extends HTMLElement {
 connectedCallback(){const s=this.attachShadow({mode:'open'});s.innerHTML='<style>:host{position:fixed;right:32px;bottom:32px;z-index:1000;pointer-events:none}.wrapper{display:flex;flex-direction:column-reverse;align-items:flex-end;gap:16px}.panel{height:151px;width:308px;max-width:calc(100vw - 64px);opacity:0;pointer-events:none}button{font:14px Arial;height:36px;padding:0 16px;background:#262626;color:white;border:0;border-radius:32px;pointer-events:auto}</style><div class="wrapper"><button type="button">'+this.getAttribute('expand-text')+'</button><div class="panel"></div></div>'}
});`;
const control = process.env.FPC_WIDGET_CONTROL === 'fixed';
const browser=await chromium.launch(); const rows=[]; let posts=0;
try {
 for(const width of [360,390,820,1440]) for(const path of ['/','/es/','/estimate/','/es/estimado/']) {
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
  await c.route('**/*', async route=>{
   const u=new URL(route.request().url());
   if(route.request().method()!=='GET'){posts++;return route.abort();}
   if(u.href==='https://elevenlabs.io/convai-widget/index.js')return route.fulfill({contentType:'text/javascript',body:fixture});
   if(u.hostname!=='fpc.test')return route.abort();
   let name=u.pathname.replace(/^\//,'');if(name.endsWith('/')||!name)name+='index.html';
   try {let body=await readFile(new URL(name,root));
    if(control&&name.endsWith('.html'))body=Buffer.from(body.toString().replace('</style>','@media(max-width:899px){elevenlabs-convai{position:fixed;right:12px;bottom:80px;padding:0;margin:0;width:auto;max-width:none}}</style>'));
    const type={html:'text/html',js:'text/javascript',svg:'image/svg+xml',woff2:'font/woff2'}[name.split('.').pop()];
    return route.fulfill({body,contentType:type||'application/octet-stream'});
   }catch{return route.fulfill({status:404,body:''});}
  });
  const p=await c.newPage();await p.goto('https://fpc.test'+path);await p.evaluate(()=>document.fonts.ready);
  await p.keyboard.press('Shift');await p.waitForFunction(()=>document.querySelector('elevenlabs-convai')?.shadowRoot?.querySelector('button'));
  const result=await p.evaluate(async()=>{
   const host=document.querySelector('elevenlabs-convai'),pill=host.shadowRoot.querySelector('button');
   const form=document.querySelector('.estimate-start, #estimate-form');
   const hit=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   const positions=[0,form.offsetTop,form.offsetTop+form.offsetHeight/2,form.offsetTop+form.offsetHeight,document.documentElement.scrollHeight];
   const intersections=[];
   for(const y of positions){scrollTo({top:y,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));if(hit(pill.getBoundingClientRect(),form.getBoundingClientRect()))intersections.push(y);}
   const box=pill.getBoundingClientRect(),bar=document.querySelector('.action-bar')?.getBoundingClientRect()||{top:innerHeight};
   return {position:getComputedStyle(host).position,intersections,bottomClearance:bar.top-box.bottom,overflow:document.documentElement.scrollWidth>innerWidth,agent:host.getAttribute('agent-id'),language:host.getAttribute('override-language')};
  });
  assert.equal(result.overflow,false,`${width} ${path} overflow`);
  assert.equal(result.agent,'agent_5901m5pm1yqefbmafzk9qhw20hrc');
  assert.equal(result.language,path.startsWith('/es/')?'es':'en');
  if(width<900){assert.deepEqual(result.intersections,[],`${width} ${path}: launcher covers the form`);assert.ok(result.bottomClearance>=16,`${width} ${path}: mobile bar covers JJ`);}
  else assert.equal(result.position,'fixed','desktop launcher placement stays fixed');
  rows.push({width,path,...result});await c.close();
 }
 assert.equal(posts,0);await writeFile(out+'/clearance.json',JSON.stringify({fixture:'inert closed-vendor geometry, not provider integration proof',posts,rows},null,2));
 console.log(`PASS: ${rows.length} page/viewport layouts, five scroll positions each; no mobile form intersections; bar clearance; desktop retained; zero POSTs.`);
}finally{await browser.close();}
