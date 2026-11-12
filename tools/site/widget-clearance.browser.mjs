// Local-only JJ interaction/layout contract. The inert shadow fixture mimics the CDN
// launcher and hidden panel geometry. Actual CDN screenshots/matrix are separate proof.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../contact-form/package.json',import.meta.url))('playwright');
const root=new URL('../../',import.meta.url),out=process.env.FPC_EVIDENCE_DIR||'/tmp/fpc-jj-compact';
await mkdir(out,{recursive:true});
const control=process.env.FPC_WIDGET_CONTROL||'';
const fixture=`customElements.define('elevenlabs-convai',class extends HTMLElement{connectedCallback(){const s=this.attachShadow({mode:'open'});s.innerHTML='<style>:host{position:fixed;right:32px;bottom:32px;z-index:1000;pointer-events:none}.wrapper{display:flex;flex-direction:column-reverse;align-items:flex-end;gap:16px}.panel{height:151px;width:308px;max-width:calc(100vw - 64px);opacity:0;pointer-events:none}.panel.open{opacity:1;pointer-events:auto}button{font:14px Arial;min-height:36px;padding:0 16px;background:#262626;color:white;border:0;border-radius:32px;pointer-events:auto}button slot{margin-right:4px}</style><div class="wrapper"><button type="button" title="'+this.getAttribute('expand-text')+'"><slot>☎</slot><div>'+this.getAttribute('expand-text')+'</div></button><div class="panel"></div></div>';s.querySelector('button').onclick=()=>s.querySelector('.panel').classList.toggle('open')}});`;
const browser=await chromium.launch();const rows=[];let posts=0;
async function setup(width,path,motion='reduce',height=844){
 const c=await browser.newContext({viewport:{width,height},reducedMotion:motion});
 await c.route('**/*',async route=>{
  const u=new URL(route.request().url());if(route.request().method()!=='GET'){posts++;return route.abort();}
  if(u.href==='https://elevenlabs.io/convai-widget/index.js')return route.fulfill({contentType:'text/javascript',body:fixture});
  if(u.hostname!=='fpc.test')return route.abort();
  let name=u.pathname.replace(/^\//,'');if(!name||name.endsWith('/'))name+='index.html';
  try {let body=await readFile(new URL(name,root));
   if(control==='heading'&&name.endsWith('.html'))body=Buffer.from(body.toString().replace('.estimate-start__heading, .estimate-start__row, .estimate-start__note { padding-right: 60px; }','.estimate-start__row, .estimate-start__note { padding-right: 60px; }').replace('.estimate-start__heading { flex-wrap: wrap; }',''));
   if(control==='reserve'&&name.endsWith('.html'))body=Buffer.from(body.toString().replace(/\.estimate-start__heading, \.estimate-start__row, \.estimate-start__note \{ padding-right: 60px; \}/,''));
   if(control==='focus'&&name==='assets/site/core.js')body=Buffer.from(body.toString().replace('focused || submitVisible','false || submitVisible'));
   if(control==='fallback'&&name==='assets/site/core.js')body=Buffer.from(body.toString().replace("if (!launcher) { clearSuppression(); return; }","if (!launcher) { el.style.opacity = '0'; return; }"));
   return route.fulfill({body,contentType:{html:'text/html',js:'text/javascript',svg:'image/svg+xml',woff2:'font/woff2'}[name.split('.').pop()]||'application/octet-stream'});
  }catch{return route.fulfill({status:404,body:''});}
 });
 const p=await c.newPage();await p.goto('https://fpc.test'+path);await p.evaluate(()=>document.fonts.ready);
 if(width>=900)await p.keyboard.press('Shift');
 await p.waitForFunction(()=>document.querySelector('elevenlabs-convai')?.classList.contains('jj-adapted'));
 await p.waitForTimeout(40);return {p,c};
}
async function state(p){return p.evaluate(()=>{const e=document.querySelector('elevenlabs-convai'),b=e.shadowRoot.querySelector('button'),r=b.getBoundingClientRect();return {opacity:+getComputedStyle(e).opacity,inert:e.inert,adapted:e.classList.contains('jj-adapted'),position:getComputedStyle(e).position,label:b.getAttribute('aria-label'),title:b.title,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth,transition:getComputedStyle(e).transitionDuration};});}
async function blur(p){await p.evaluate(()=>document.activeElement.blur());await p.waitForTimeout(200);}
try{
 for(const width of [360,390,820,1440])for(const path of ['/','/es/','/estimate/','/es/estimado/']){
  const {p,c}=await setup(width,path);const initial=await state(p);
  assert.equal(initial.overflow,false);
  if(width<900){assert.ok(initial.width>=44&&initial.height>=44);assert.equal(initial.title,'Chat with JJ');assert.equal(initial.label,'Chat with JJ');}
  if(width<=390&&(path==='/'||path==='/es/'))assert.equal(initial.opacity,1,'JJ visible on initial home load without any interaction');
  if(width>=900){assert.equal(initial.position,'fixed');assert.equal(initial.height,36,'desktop visual height unchanged');}
  if(width<900){
   // Native focus scrolls a control into view; JJ hides, then returns after blur away from conflict.
   const field=p.locator(path.includes('estimate')||path.includes('estimado')?'#first_name':'.estimate-start select');
   await field.focus();await p.waitForTimeout(200);assert.equal((await state(p)).opacity,0,'focus hides JJ');assert.equal((await state(p)).inert,true);
   await blur(p);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(200);
   const positions=await p.evaluate(()=>{const f=document.querySelector('.estimate-start,#estimate-form');return [0,f.offsetTop,f.offsetTop+f.offsetHeight/2,f.offsetTop+f.offsetHeight,document.documentElement.scrollHeight];});
   for(const y of positions){await p.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await p.waitForTimeout(200);
    const hit=await p.evaluate(()=>{const e=document.querySelector('elevenlabs-convai');if(+getComputedStyle(e).opacity<.01)return false;const a=e.shadowRoot.querySelector('button').getBoundingClientRect();const intersects=b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;for(const f of document.querySelectorAll('main form')){for(const control of f.querySelectorAll('input:not([type="hidden"]),select,textarea,button'))if(intersects(control.getBoundingClientRect()))return true;const walker=document.createTreeWalker(f,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode;if(!n.textContent.trim()||n.parentElement.closest('script,style,[hidden],[aria-hidden="true"]'))continue;const r=document.createRange();r.selectNodeContents(n);for(const b of r.getClientRects())if(intersects(b))return true;}}return false;});
    assert.equal(hit,false,`${width} ${path} visible JJ intersects form text/control at scroll ${y}`);
   }
   if(path.includes('estimate')||path.includes('estimado')){
    await p.locator('#submit').scrollIntoViewIfNeeded();await p.waitForTimeout(200);assert.equal((await state(p)).opacity,0,'submit observer hides JJ');
   }
   await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await p.waitForTimeout(200);
   assert.equal((await state(p)).opacity,1,'JJ restores away from forms');
   if(width<900){const margin=await p.evaluate(()=>{const b=document.querySelector('elevenlabs-convai').shadowRoot.querySelector('button').getBoundingClientRect(),bar=document.querySelector('.action-bar');return (bar?.getBoundingClientRect().top??innerHeight)-b.bottom;});assert.ok(margin>=8,`bar/bottom clears launcher: ${width} ${path} gap ${margin}`);}
   assert.equal((await state(p)).transition,'0s','reduced motion removes fade');
   // Markup replacement must fail open to CDN default and recover if the label returns.
   await p.evaluate(()=>{const e=document.querySelector('elevenlabs-convai'),b=e.shadowRoot.querySelector('button');b.className='';b.title='Changed CDN markup';});await p.waitForTimeout(200);
   let fallback=await state(p);assert.equal(fallback.adapted,false);assert.equal(fallback.opacity,1,'selector miss leaves CDN visible');assert.equal(fallback.inert,false);
   await p.evaluate(()=>{const e=document.querySelector('elevenlabs-convai');e.shadowRoot.querySelector('button').title=e.getAttribute('expand-text');});await p.waitForTimeout(200);assert.equal((await state(p)).adapted,true,'matching markup re-adapts');
  }
  rows.push({width,path,initial});await c.close();
 }
 const shortHomes=[];
 for(const width of [320,360,375,390])for(const height of [620,640,664,690,740,844])for(const path of ['/','/es/']){
  const {p,c}=await setup(width,path,'reduce',height);const initial=await state(p);
  assert.equal(initial.opacity,1,`home JJ visible on load ${width}x${height} ${path}`);
  assert.equal(initial.inert,false);assert.equal(initial.overflow,false);assert.ok(initial.width>=44&&initial.height>=44);
  shortHomes.push({width,height,path,initial});await c.close();
 }
 const {p,c}=await setup(390,'/','no-preference');await p.locator('.estimate-start select').focus();await p.waitForTimeout(240);assert.equal((await state(p)).opacity,0);await blur(p);await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));await p.waitForTimeout(240);assert.equal((await state(p)).opacity,1,'motion-enabled restore');await c.close();
 assert.equal(posts,0);await writeFile(out+'/clearance.json',JSON.stringify({fixture:'inert CDN geometry, not real call proof',posts,rows,shortHomes},null,2));console.log('PASS:16 interaction layouts plus48 home width/height/language layouts; mobile on-load visibility,48px accessible icon,focus/blur,scroll clearance,submit observer,selector fallback/recovery,reduced-motion and desktop preservation. Zero POSTs.');
}finally{await browser.close();}
