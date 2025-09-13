(() => {
/* =============================================================================
   EditUploadsV1 — v1.0.1
   Notes:
       • Written as a zero-dependency console userscript for portability (BetterDiscord / Vencord ports later).
       • Uses DOM-only APIs and query-by-aria to stay resilient to className churn.
   ---------------------------------------------------------------------------
   Patch notes from 1.0.0 → 1.0.1
   - Added Settings panel:
     • HDR/SDR handling: Auto, Force SDR (tone map), HDR look
     • RGB border glow: speed slider, Dynamic, Static, Off
     • Edit button injection toggles (Attachments, Viewer, Other)
   - HDR/SDR status badge shown next to resolution/size readout
   - Re-arranged/clarified editor header controls
   - Fixed canvas panning (hand tool drag) + general pointer handling
   - Added text outline/shadow toggle for the Text tool
   - Rebuilt chat “Edit” button injection for reliability (no longer web-only)
   - Performance cleanups: less code, faster init, fewer reflows, no UI delays
   - Fixed stray white “edit” buttons on hover over messages
   ---------------------------------------------------------------------------
   Distribution:
   - Single-file IIFE (no globals) — persists minimal state in localStorage.
   - Key: "EU_cfg" (domain scope)
   - Non-destructive to Discord DOM; clones native icons when possible.

   Dev conventions:
   - Keep DOM queries narrow, test for visibility, and prefer aria-labels.
   - All timers short and idempotent (safe to re-run).
   - No console logs or debug traces in release builds.
   ========================================================================== */

(()=>{const VER="v1.0.1",BTN_ARIA="Edit Upload (EU)",DELETE_ON_EDIT=true,EXTRA_DELETE_ON_SAVE=false,CAPTURE_PASTE_ALWAYS=true,SUPPORT_URL="/invite/SADyYHbWn5";

/* ---------------------------- DOM/utility helpers ------------------------- */
const q=(s,p=document)=>p.querySelector(s),qa=(s,p=document)=>Array.from(p.querySelectorAll(s));
const rgba=(hex,a=1)=>{const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)||[];return`rgba(${parseInt(m[1]||"ff",16)},${parseInt(m[2]||"00",16)},${parseInt(m[3]||"00",16)},${a})`};
/* React fiber root traversal (local-only, no external APIs) */
const fiber=n=>{for(const k in n) if(k.startsWith("__reactFiber$")) return n[k]};
/* Robustly locate an image File/Blob nested in arbitrary props */
const deepFindFile=(x,s=new WeakSet())=>{if(!x||typeof x!=="object"||s.has(x))return null;s.add(x);
 if((x instanceof File||x instanceof Blob)&&/^image\//.test(x.type||""))return x;
 if(x.item?.file&&(x.item.file instanceof File||x.item.file instanceof Blob))return x.item.file;
 if(x.file&&(x.file instanceof File||x instanceof Blob))return x.file;
 if(Array.isArray(x)){for(const v of x){const r=deepFindFile(v,s);if(r)return r}}
 else{for(const k of Object.keys(x)){const r=deepFindFile(x[k],s);if(r)return r}}return null};
/* Try to clone a native Discord SVG by aria-label heuristic; fallback later */
const cloneByAriaIncludes=(list)=>{for(const t of list){const b=qa(`button[aria-label*="${t}"],[aria-label*="${t}"]`).find(x=>x.offsetParent!==null);const s=b?.querySelector?.("svg");if(s)return s.outerHTML}return null};

/* ------------------------------- Icon set --------------------------------- */
/* Native clones if available (helps keep style parity with Discord) */
const nativeClose=cloneByAriaIncludes(["Close","Dismiss","close"]);
const nativeUndo =cloneByAriaIncludes(["Undo","undo"]);
const nativeRedo =cloneByAriaIncludes(["Redo","redo"]);
const nativeSend =cloneByAriaIncludes(["Send Message","Send","send"]);
const nativeTrash=cloneByAriaIncludes(["Remove Attachment","Remove","Delete","Trash"]);
const nativeGear =cloneByAriaIncludes(["User Settings","Settings","settings","Cog","cog"]);

/* Fallback SVGs (kept minimal to avoid layout shifts) */
const ICON={
 /* icon retained (1.0.0) */
 help:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm0 16a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm2.05-8.7c-.19.31-.5.58-.92.82l-.53.3c-.28.16-.47.32-.57.48a1.4 1.4 0 0 0-.19.74v.36h-2v-.48c0-.62.14-1.12.42-1.5.28-.39.75-.76 1.41-1.12.31-.17.53-.33.65-.48.13-.16.19-.33.19-.53 0-.31-.11-.56-.34-.74-.22-.18-.55-.27-.99-.27-.39 0-.72.07-1 .22-.28.15-.52.37-.71.66l-1.73-1.12c.31-.53.76-.94 1.33-1.24.58-.3 1.27-.45 2.09-.45 1.03 0 1.85.25 2.47.74.63.5.94 1.17.94 2.02 0 .39-.1.76-.29 1.07Z"/></svg>`,
 gear:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm8.2 2.1-.9-.15a6.9 6.9 0 0 0-.63-1.52l.57-.72a1 1 0 0 0-.06-1.29l-1.63-1.63a1 1 0 0 0-1.29-.06l-.72.57c-.49-.25-1-.46-1.52-.63L13.6 4a1 1 0 0 0-1-.8h-1.2a1 1 0 0 0-1 .8l-.15.9c-.52.17-1.03.38-1.52.63l-.72-.57a1 1 0 0 0-1.29.06L3.99 6.65a1 1 0  0 0-.06 1.29l.57.72c-.25.49-.46 1-.63 1.52l-.9.15a1 1 0 0 0-.8 1v1.2a1 1 0 0 0 .8 1l.9.15c.17.52.38 1.03.63 1.52l-.57.72a1 1 0 0 0 .06 1.29l1.63 1.63a1 1 0 0 0 1.29.06l.72-.57c.49.25 1 .46 1.52.63l.15.9a1 1 0 0 0 1 .8h1.2a1 1 0 0 0 1-.8l.15-.9c.52-.17 1.03-.38 1.52-.63l.72.57a1 1 0 0 0 1.29-.06l1.63-1.63a1 1 0 0 0 .06-1.29l-.57-.72c.25-.49.46-1 .63-1.52l.9-.15a1 1 0 0 0 .8-1v-1.2a1 1 0 0 0-.8-1Z"/></svg>`,
 send:nativeSend||`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 21l21-9L2 3v7l14 2L2 14z"/></svg>`,
 close:nativeClose||`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>`,
 trash:nativeTrash||`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3zM11 7h2v11h-2z"/></svg>`,
 zoomIn:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.93-2.27l.27.28v.79l5 5 1.5-1.5-5-5M9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14"/><path fill="currentColor" d="M10 7v2h2v1h-2v2H9v-2H7V9h2V7z"/></svg>`,
 zoomOut:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.93-2.27l.27.28v.79l5 5 1.5-1.5-5-5M9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14M7 9h5v1H7z"/></svg>`,
 fit:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h6V2H2v8h2V4m8-2v2h6v6h2V2m-2 18h-6v2h8v-8h-2v6M4 14H2v8h8v-2H4v-6Z"/></svg>`,
 dl:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2Zm7-18-5 5h3v6h4V7h3l-5-5Z"/></svg>`,
 brush:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.1 3.9 20.1 9.9 9 21H3v-6l11.1-11.1z"/></svg>`,
 eraser:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.24 3.56 21 8.32l-9.19 9.19H7.05L3 13.46l9.19-9.9a2 2 0 0 1 2.83 0z"/></svg>`,
 arrow:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 12h14.17l-4.59-4.59L13 6l7 7-7 7-1.41-1.41L16.17 14H2v-2Z"/></svg>`,
 rect:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v14H3V5m2 2v10h14V7H5Z"/></svg>`,
 circle:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
 text:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 6V4h16v2h-7v14h-2V6H4z"/></svg>`,
 crop:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 3h2v2H7v3H5V5a2 2 0 0 1 2-2Zm10 0a2 2 0 0 1 2 2v2h-2V5h-3V3h3ZM7 21a2 2 0 0 1-2-2v-2h2v2h3v2H7Zm10 0h-3v-2h3v-3h2v3a2 2 0 0 1-2 2Z"/></svg>`,
 blur:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3s7 7.58 7 11a7 7 0 0 1-14 0c0-3.42 7-11 7-11"/></svg>`,
 unblur:`<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c0 0 7 7.6 7 11a7 7 0 0 1-7 7 7 7 0 0 1-7-7c0-3.4 7-11 7-11"/><path d="M5 5l14 14"/></g></svg>`,
 hand:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 11V6a1 1 0 0 1 2 0v4h1V5a1 1 0  0 1 2 0v5h1V6a1 1 0 1 1 2 0v6h1V9a1 1 0 1 1 2 0v6c0 3-2 5-5 5H9c-2.2 0-4-1.8-4-4v-5a1 1 0  0 1 2 0v4z"/></svg>`,
 /* Inline “Edit” pencil used for tiles/viewer buttons */
 pencil:`<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75L18.81 8.94l-3.75-3.75L3 17.25zm2.92 2.33H5.5v-.42l9.56-9.56.42.42-9.56 9.56zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.4 1.4 3.75 3.75 1.4-1.4z"/></svg>`
};

/* --------------------------- Composer & actions --------------------------- */
const getComposer=()=>q('form[aria-label*="Message"],form[aria-label*="message"]')||document;
/* Try to open Discord emoji picker (used by Text tool) */
const emojiPickerButton=()=>qa('button[aria-label*="Emoji"],button[aria-label*="emoji"]',getComposer()).find(b=>b.offsetParent!==null)||null;
/* Locate first visible attachment “Remove” button (presence == has attachments) */
const firstRemoveAttachmentBtn=()=>{const r=getComposer();const sel=[
  'div[role="dialog"] [aria-label="Remove Attachment"]',
  '[class*="upload"] [aria-label="Remove Attachment"]',
  '[class*="attachment"] [aria-label="Remove Attachment"]',
  'button[aria-label="Remove"]','button[aria-label="Delete"]'
].join(',');return qa(sel,r).find(b=>b.offsetParent!==null)||null};
const composerHasAttachments=()=>!!firstRemoveAttachmentBtn();
/* Attempt to send via primary “Send” button; fallback to Enter-key or submit() */
const sendNow=()=>{const root=getComposer();const btn=qa(['button[aria-label="Send Message"]','button[aria-label="Send"]','button[aria-label*="Send"]','button[type="submit"]','[data-testid="send-button"]','[class*="buttons"] button[aria-label*="Send"]'].join(','),root).find(b=>b.offsetParent!==null);
 if(btn){["mousemove","mousedown","mouseup","click"].forEach(t=>btn.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window})));return true}
 const box=q('[role="textbox"]',root);if(box){box.focus();const k=t=>new KeyboardEvent(t,{key:"Enter",code:"Enter",which:13,keyCode:13,bubbles:true,cancelable:true,composed:true});["keydown","keypress","keyup"].forEach(t=>box.dispatchEvent(k(t)));return true}
 const form=root;if(form){form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true}return false};
/* Remove all attachments + clear text area (bounded retries, safe) */
const purgeComposer=()=>{let rounds=0;(function tick(){let hit=false;
 qa(['button[aria-label="Remove"]','button[aria-label="Delete"]','button[aria-label*="Remove Attachment"]','[class*="upload"] button[aria-label*="Remove"]','[class*="attachment"] button[aria-label*="Remove"]'].join(','),getComposer()).forEach(b=>{(b.offsetParent!==null)&&(b.click(),hit=true)});
 const box=q('[role="textbox"]',getComposer());if(box){const sel=getSelection(),r=document.createRange();r.selectNodeContents(box);sel.removeAllRanges();sel.addRange(r);document.execCommand("delete");box.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,inputType:"deleteContentBackward"}))}
 if(hit&&rounds++<8)setTimeout(tick,60)})()};
/* Feed a File into Discord’s hidden file input */
const injectFile=f=>{const i=q('input[type="file"]',getComposer())||q('input[type="file"]');if(!i)return false;const dt=new DataTransfer();dt.items.add(f);i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));return true};
/* Media URL normalization for Discord CDN */
const normalizeCDN=url=>{if(!url)return null;try{const u=new URL(url,location.href);if(u.hostname.includes("media.discordapp.net"))u.hostname="cdn.discordapp.com";["width","height","quality","format"].forEach(k=>u.searchParams.delete(k));return u.toString()}catch{return url}};
const fromSrcSet=img=>{const s=img.getAttribute("srcset");if(!s)return null;const p=s.split(",").map(x=>x.trim().split(" ")[0]).filter(Boolean);return p[p.length-1]||null};
const resolveFullsizeFromImg=img=>{const a=img.closest('a[href]');if(a&&/discordapp\.(com|net)/.test(a.href))return normalizeCDN(a.href);const ss=fromSrcSet(img);if(ss)return normalizeCDN(ss);return normalizeCDN(img.currentSrc||img.src||"")};
/* Prefer the biggest non-avatar <img> as a candidate */
const biggestNonAvatarImg=root=>{const imgs=qa('img',root).filter(i=>{const cls=(i.className||"")+" "+(i.parentElement?.className||"");const aria=(i.getAttribute('aria-label')||"").toLowerCase();return!/(^| )avatar|pfp|mask|user|guild/i.test(cls+aria)});let best=null,area=0;for(const im of imgs){const w=im.naturalWidth||im.width||0,h=im.naturalHeight||im.height||0;if(w*h>area){area=w*h;best=im}}return best};

/* --------------------------------- Styles --------------------------------- */
/* Keep look/feel consistent with Discord; only tune sizes where requested */
if(!q('#eu-style')){const st=document.createElement('style');st.id='eu-style';st.textContent=`
#eu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000000;display:flex;align-items:center;justify-content:center}
#eu-panel{width:min(96vw,1200px);height:min(96vh,820px);background:var(--background-primary,#2b2d31);border:1px solid var(--background-modifier-accent,#3f4147);border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.55);display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;color:var(--text-normal,#dbdee1)}
#eu-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--background-tertiary,#1e1f22);border-bottom:1px solid var(--background-modifier-accent,#3f4147)}
#eu-left{display:flex;align-items:center;gap:10px}
#eu-title{font-weight:700}
/* OG help glyph sizing */
#eu-support{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;color:#6aa5ff}
#eu-support svg{width:20px;height:20px}
/* Buttons + upscale specific icons per request */
.eu-btn{background:var(--button-secondary-background,#313338);color:var(--interactive-normal);border:1px solid var(--background-modifier-accent,#3f4147);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;justify-content:center;line-height:18px;height:44px}
.eu-btn:hover{background:var(--button-secondary-background-hover,#3a3c41);color:var(--interactive-active)}
.eu-btn svg{width:28px;height:28px}
.eu-btn.icon{width:52px;height:44px}
.eu-btn.icon svg{width:36px;height:36px}
/* Larger: settings, zoom, download */
#eu-settings svg{width:40px;height:40px}
#eu-zoom-in svg,#eu-zoom-out svg{width:44px;height:44px}
#eu-download svg{width:46px;height:46px}
#eu-zoom-fit svg{width:36px;height:36px}
.eu-primary{background:var(--brand-experiment,#5865f2);border:none;color:#fff}
.eu-green{background:#23a559;border:none;color:#fff}
.eu-danger{background:#da373c;border:none;color:#fff}
#eu-zoombar{display:flex;align-items:center;gap:8px}
/* Info bar (filename • res • size • SDR/HDR) */
#eu-infobar-wrap{flex:1;display:flex;justify-content:center}
#eu-infobar{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--text-muted);max-width:70%;min-width:220px;overflow:hidden;white-space:nowrap;cursor:pointer}
#eu-info-name{overflow:hidden;text-overflow:ellipsis;max-width:60%}
#eu-info-badge{padding:0 6px;border-radius:4px;border:1px solid var(--background-modifier-accent);font-size:11px}
/* Toolbar grid: color, sliders, tools, place bar */
.eu-toolbar{display:grid;grid-template-columns:auto 1fr 1fr;gap:16px;padding:10px 12px;background:var(--background-secondary,#2b2d31);border-bottom:1px solid var(--background-modifier-accent,#3f4147);align-items:start}
#eu-color-wrap{display:flex;flex-direction:column;gap:8px}
.eu-label{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px}
#eu-chip{width:18px;height:18px;border-radius:4px;border:1px solid var(--background-modifier-accent);display:inline-block;cursor:pointer}
/* Brush color picker: H + SV (SV toggled by chip) */
#eu-ncp-h{display:block}
#eu-ncp-hex{display:block}
#eu-ncp-sv{display:none}
#eu-ncp-h,#eu-rgb-h{width:180px;height:12px;border-radius:6px;border:1px solid var(--background-modifier-accent);overflow:hidden}
#eu-ncp-hex,#eu-rgb-hex{width:180px;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-accent);background:var(--input-background,#2b2d31);color:var(--text-normal)}
#eu-ncp-sv,#eu-rgb-sv{width:180px;height:120px;border-radius:8px;overflow:hidden;position:relative;border:1px solid var(--background-modifier-accent)}
/* Tool cluster + active state ring */
#eu-tools{display:grid;grid-template-columns:repeat(10,34px);grid-auto-rows:34px;gap:8px;align-items:center;justify-content:flex-end}
.eu-tool,.eu-btn.icon{width:34px;height:34px}
.eu-tool{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--background-modifier-accent);background:var(--button-secondary-background);color:var(--interactive-normal)}
.eu-tool.active,.eu-tool:hover{outline:2px solid var(--brand-experiment,#5865f2)}
/* Stage + canvases */
#eu-cc,#eu-cv,#eu-overlay-cv{position:absolute;left:0;top:0}
#eu-stage-wrap{position:relative;overflow:hidden;background:#101115}
#eu-stage{position:absolute;left:0;top:0;transform-origin:0 0}
#eu-cv{z-index:1;border:2px dashed rgba(255,255,255,.35)}
#eu-overlay-cv{z-index:2;pointer-events:none}
/* RGB border glow: dynamic = hue-rotate + breathe, static = fixed color */
#eu-borderglow{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;border-radius:6px;z-index:2;box-shadow:0 0 26px 14px rgba(255,0,0,.35);filter:hue-rotate(0deg);animation:eu-rgb-hue 6s linear infinite,eu-rgb-breathe 2.3s ease-in-out infinite}
/* Burst = temporary pulse (no animation reset artifacts) */
.eu-burst{transition:box-shadow .45s ease}
@keyframes eu-rgb-hue{from{filter:hue-rotate(0)}to{filter:hue-rotate(360deg)}}
@keyframes eu-rgb-breathe{0%,100%{opacity:.88}50%{opacity:1}}
/* Popovers: settings / text / rename */
.eu-pop{position:absolute;display:none;z-index:5;min-width:360px;max-width:560px;background:var(--background-floating,#111214);border:1px solid var(--background-modifier-accent);border-radius:8px;padding:10px;box-shadow:0 12px 24px rgba(0,0,0,.5)}
.eu-pop input{width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-accent);background:var(--input-background,#2b2d31);color:var(--text-normal)}
.eu-pop .row{display:flex;gap:10px;align-items:center;margin-top:6px;flex-wrap:wrap}
.eu-pop .vcol{display:flex;flex-direction:column;gap:8px;margin-top:8px}
/* Sliders with progress tint */
.eu-range{width:260px;height:18px;-webkit-appearance:none;background:transparent}
.eu-range::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(var(--brand-experiment,#5865f2),var(--brand-experiment,#5865f2)) 0/var(--pos,0%) 100% no-repeat,var(--background-modifier-accent,#3f4147)}
.eu-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--brand-experiment,#5865f2);margin-top:-5px}
.eu-range::-moz-range-track{height:4px;border-radius:4px;background:var(--background-modifier-accent,#3f4147)}
.eu-range::-moz-range-progress{height:4px;border-radius:4px;background:var(--brand-experiment,#5865f2)}
.eu-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--brand-experiment,#5865f2)}
/* Toggle switches */
.eu-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;color:var(--text-normal)}
.eu-switch input{display:none}
.eu-switch span{position:relative;width:36px;height:20px;border-radius:999px;background:var(--background-modifier-accent);display:inline-block;vertical-align:middle;transition:.2s}
.eu-switch span::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.2s}
.eu-switch input:checked + span{background:var(--brand-experiment,#5865f2)}
.eu-switch input:checked + span::after{left:18px}
.eu-switch em{font-style:normal;color:var(--text-muted)}
/* Inline “Edit Upload” tile button + custom tooltip */
button[aria-label="${BTN_ARIA}"]{background:var(--button-secondary-background,#313338)!important;color:var(--interactive-normal)!important;border:1px solid var(--background-modifier-accent)!important;border-radius:8px;padding:6px;display:inline-flex;align-items:center;justify-content:center;line-height:0;font-size:0;position:relative}
button[aria-label="${BTN_ARIA}"] svg{width:18px;height:18px;color:var(--brand-experiment,#5865f2)!important;fill:var(--brand-experiment,#5865f2)!important}
.eu-tip{position:fixed;z-index:1000001;background:var(--background-floating,#111214);color:var(--text-normal,#dbdee1);border:1px solid var(--background-modifier-accent,#3f4147);padding:6px 8px;border-radius:6px;font-size:12px;pointer-events:none;box-shadow:0 8px 20px rgba(0,0,0,.4);white-space:nowrap;opacity:0;transform:translateY(4px);transition:opacity .12s ease,transform .12s ease}
.eu-tip.show{opacity:1;transform:translateY(0)}
`;document.head.appendChild(st)}

/* ------------------------------- Editor core ------------------------------- */
/* Instantiate modal editor with a Blob image */
function openEditorWithBlob(blob){
 const ov=document.createElement('div');ov.id='eu-overlay';ov.innerHTML=`
  <div id="eu-panel" role="dialog" aria-modal="true" aria-label="EditUploadsV1">
   <div id="eu-hdr">
    <div id="eu-left">
      <a id="eu-support" href="${SUPPORT_URL}" title="Support / Invite">${ICON.help}</a>
      <div id="eu-title">EditUploadsV1</div>
      <div id="eu-zoombar">
        <button class="eu-btn icon" id="eu-settings" title="Settings">${nativeGear||ICON.gear}</button>
        <button class="eu-btn icon" id="eu-zoom-out" title="Zoom out">${ICON.zoomOut}</button>
        <button class="eu-btn icon" id="eu-zoom-in" title="Zoom in">${ICON.zoomIn}</button>
        <div id="eu-zoom-label">100%</div>
        <button class="eu-btn icon" id="eu-zoom-fit" title="Fit">${ICON.fit}</button>
        <button class="eu-btn icon" id="eu-download" title="Download">${ICON.dl}</button>
      </div>
    </div>
    <div id="eu-infobar-wrap">
      <div id="eu-infobar" title="Rename">
        <span id="eu-info-name">—</span><span>•</span><span id="eu-info-res">—</span><span>•</span><span id="eu-info-size">—</span><span id="eu-info-badge">SDR</span>
      </div>
    </div>
    <div id="eu-actions" style="display:flex;align-items:center;gap:8px;padding-right:8px">
      <button class="eu-btn eu-danger"  id="eu-trash">${ICON.trash}<span>&nbsp;Remove</span></button>
      <button class="eu-btn eu-primary" id="eu-send">${ICON.send}<span>&nbsp;Send</span></button>
      <button class="eu-btn eu-green"   id="eu-save">✔<span>&nbsp;Save</span></button>
      <button class="eu-btn" id="eu-close">${ICON.close}<span>&nbsp;Close</span></button>
    </div>
   </div>

   <div class="eu-toolbar">
     <!-- Brush color picker -->
     <div id="eu-color-wrap">
       <div class="eu-label">Color <span id="eu-chip"></span></div>
       <canvas id="eu-ncp-h"></canvas>
       <input id="eu-ncp-hex" placeholder="# ff0000" value="#ff0000">
       <canvas id="eu-ncp-sv"></canvas>
     </div>

     <!-- Brush/Effect sliders -->
     <div id="eu-sliders">
       <div class="eu-col"><div class="eu-label">Size</div><input type="range" id="eu-size" class="eu-range" min="2" max="120" value="2"></div>
       <div class="eu-col"><div class="eu-label">Strength</div><input type="range" id="eu-strength" class="eu-range" min="0" max="1" step="0.05" value="1"></div>
     </div>

     <!-- Tools -->
     <div id="eu-tools">
       <button class="eu-tool" data-tool="hand"   title="Move">${ICON.hand}</button>
       <button class="eu-tool" data-tool="brush"  title="Brush">${ICON.brush}</button>
       <button class="eu-tool" data-tool="eraser" title="Eraser">${ICON.eraser}</button>
       <button class="eu-tool" data-tool="arrow"  title="Arrow">${ICON.arrow}</button>
       <button class="eu-tool" data-tool="rect"   title="Rectangle">${ICON.rect}</button>
       <button class="eu-tool" data-tool="circle" title="Circle">${ICON.circle}</button>
       <button class="eu-tool" data-tool="text"   title="Text">${ICON.text}</button>
       <button class="eu-tool" data-tool="crop"   title="Crop">${ICON.crop}</button>
       <button class="eu-tool" data-tool="blurpaint"   title="Blur brush">${ICON.blur}</button>
       <button class="eu-tool" data-tool="unblurpaint" title="Inverse blur">${ICON.unblur}</button>

       <!-- Undo/Redo/Reset -->
       <div style="grid-column:-4 / -1;display:flex;justify-content:flex-end;gap:8px">
         <button class="eu-btn icon" id="eu-undo" title="Undo">${nativeUndo||"↶"}</button>
         <button class="eu-btn icon" id="eu-redo" title="Redo">${nativeRedo||"↷"}</button>
         <button class="eu-btn icon" id="eu-reset" title="Reset">Reset</button>
       </div>

       <!-- Placement confirm/cancel (for pasted images) -->
       <div id="eu-placebar" style="grid-column:1 / -1;justify-content:flex-end;display:none;gap:8px">
         <button class="eu-btn eu-green" id="eu-place-ok">✔</button>
         <button class="eu-btn eu-danger" id="eu-place-cancel">✖</button>
       </div>
     </div>

     <!-- Settings popover -->
     <div id="eu-settings-pop" class="eu-pop">
       <div class="eu-label" style="font-weight:600">Settings</div>

       <div class="eu-label" style="margin-top:6px">RGB Border Glow</div>
       <div class="row">
         <button class="eu-btn" data-rgb="dynamic">Dynamic</button>
         <button class="eu-btn" data-rgb="static">Static</button>
         <button class="eu-btn" data-rgb="off">Off</button>
       </div>
       <div class="eu-col" style="margin-top:6px">
         <div class="eu-label">Speed</div>
         <input type="range" id="eu-rgb-speed" class="eu-range" min="0.3" max="3" step="0.1" value="1">
       </div>
       <div id="eu-rgb-picker" style="display:none;margin-top:6px">
         <div class="eu-label">Static color <span id="eu-chip2" style="width:18px;height:18px;border-radius:4px;border:1px solid var(--background-modifier-accent);display:inline-block"></span></div>
         <canvas id="eu-rgb-h"></canvas>
         <input id="eu-rgb-hex" placeholder="# ff00ff" value="#ff00ff">
         <canvas id="eu-rgb-sv"></canvas>
       </div>

       <div class="eu-label" style="margin-top:10px">HDR Handling</div>
       <div class="row">
         <button class="eu-btn" data-hdr="auto">Auto</button>
         <button class="eu-btn" data-hdr="sdr">Force SDR</button>
         <button class="eu-btn" data-hdr="hdr">HDR look</button>
       </div>

       <div class="eu-label" style="margin-top:10px">Edit buttons</div>
       <div class="vcol">
         <label class="eu-switch"><input id="eu-sw-attach" type="checkbox" checked><span></span><em>Attachments</em></label>
         <label class="eu-switch"><input id="eu-sw-viewer" type="checkbox" checked><span></span><em>Image viewer</em></label>
       </div>

       <div class="eu-label" style="margin-top:10px">Experimental</div>
       <div class="vcol" id="eu-inject-col">
         <label class="eu-switch"><input id="eu-sw-misc" type="checkbox"><span></span><em>Other images</em></label>
       </div>

       <div class="row" style="justify-content:flex-end;margin-top:12px">
         <button class="eu-btn" id="eu-save-settings">Saved</button>
       </div>
     </div>

     <!-- Text/emoji popover -->
     <div id="eu-text-pop" class="eu-pop">
       <div class="eu-label">Text / Emoji</div>
       <input id="eu-textval" placeholder="Type text…">
       <div class="row">
         <button class="eu-btn" id="eu-emoji-btn" style="width:34px;height:34px">😀</button>
         <button class="eu-btn" id="eu-text-outline" title="Outline/Shadow" style="width:34px;height:34px">T</button>
       </div>
     </div>

     <!-- Rename popover -->
     <div id="eu-rename-pop" class="eu-pop">
       <div class="eu-label">Rename file</div>
       <input id="eu-renameval" placeholder="filename.png">
       <div class="row"><button class="eu-btn eu-green" id="eu-rename-ok">✔</button><button class="eu-btn eu-danger" id="eu-rename-cancel">✖</button></div>
     </div>
   </div>

   <!-- Stage (checkerboard/backing + draw + overlay + border glow) -->
   <div id="eu-stage-wrap"><div id="eu-stage"><canvas id="eu-cc"></canvas><canvas id="eu-cv"></canvas><canvas id="eu-overlay-cv"></canvas><div id="eu-borderglow" class="eu-burst"></div></div></div>
  </div>`;document.body.appendChild(ov);

 /* Trap keystrokes inside modal; Esc closes */
 const stop=e=>e.stopPropagation();["keydown","keypress","keyup","paste"].forEach(t=>ov.addEventListener(t,stop,true));
 const close=()=>ov.remove();ov.addEventListener("click",e=>{if(!e.target.closest("#eu-panel"))closeAndCleanup()});
 ov.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeAndCleanup()}},true);

 /* Key refs */
 const stageWrap=q("#eu-stage-wrap",ov),stage=q("#eu-stage",ov),
  cv=q("#eu-cv",ov),cx=cv.getContext("2d",{willReadFrequently:true}),
  oc=q("#eu-overlay-cv",ov),ox=oc.getContext("2d"),
  cc=q("#eu-cc",ov),ccx=cc.getContext("2d",{willReadFrequently:true}),
  borderGlow=q("#eu-borderglow",ov);

 /* UI refs */
 const sizeEl=q("#eu-size",ov),strengthEl=q("#eu-strength",ov),
  textPop=q("#eu-text-pop",ov),textInput=q("#eu-textval",ov),emojiBtn=q("#eu-emoji-btn",ov),textOutlineBtn=q("#eu-text-outline",ov),
  renamePop=q("#eu-rename-pop",ov),renameInput=q("#eu-renameval",ov),renameOk=q("#eu-rename-ok",ov),renameCancel=q("#eu-rename-cancel",ov),
  undoBtn=q("#eu-undo",ov),redoBtn=q("#eu-redo",ov),resetBtn=q("#eu-reset",ov),
  saveBtn=q("#eu-save",ov),sendBtn=q("#eu-send",ov),trashBtn=q("#eu-trash",ov),closeBtn=q("#eu-close",ov),
  zoomOutBtn=q("#eu-zoom-out",ov),zoomInBtn=q("#eu-zoom-in",ov),zoomFitBtn=q("#eu-zoom-fit",ov),zoomLabel=q("#eu-zoom-label",ov),dlBtn=q("#eu-download",ov),
  infoBar=q("#eu-infobar",ov),infoName=q("#eu-info-name",ov),infoRes=q("#eu-info-res",ov),infoSize=q("#eu-info-size",ov),infoBadge=q("#eu-info-badge",ov),
  settingsBtn=q("#eu-settings",ov),settingsPop=q("#eu-settings-pop",ov),
  rgbPickerWrap=q("#eu-rgb-picker",ov),rgbH=q("#eu-rgb-h",ov),rgbSV=q("#eu-rgb-sv",ov),rgbHEX=q("#eu-rgb-hex",ov),chip2=q("#eu-chip2",ov),
  swAttach=q("#eu-sw-attach",ov),swViewer=q("#eu-sw-viewer",ov),swMisc=q("#eu-sw-misc",ov),
  saveSettingsBtn=q("#eu-save-settings",ov),speedEl=q("#eu-rgb-speed",ov),
  placeBar=q("#eu-placebar",ov),placeOk=q("#eu-place-ok",ov),placeCancel=q("#eu-place-cancel",ov);

 /* Brush color picker wiring */
 const sv=q("#eu-ncp-sv",ov),svx=sv.getContext("2d"),hb=q("#eu-ncp-h",ov),hbx=hb.getContext("2d"),hex=q("#eu-ncp-hex",ov),chip=q("#eu-chip",ov);
 [textInput,hex,rgbHEX,renameInput].forEach(inp=>["keydown","keypress","keyup"].forEach(evt=>inp.addEventListener(evt,e=>e.stopPropagation(),true)));

 /* ------------------------------- Color utils ------------------------------ */
 let HSV={h:0,s:1,v:1},stColor="#ff0000";
 const HSVtoHEX=(h,s,v)=>{let f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(Math.min(k,4-k,1),0);const r=Math.round(f(5)*255),g=Math.round(f(3)*255),b=Math.round(f(1)*255);return"#"+[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("")};
 const HEXtoHSV=hexStr=>{const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);if(!m)return HSV;const r=parseInt(m[1],16)/255,g=parseInt(m[2],16)/255,b=parseInt(m[3],16)/255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}const s=max?d/max:0;const v=max;return{h,s,v}};
 const setChip=()=>{chip.style.background=stColor};
 function setColor(hexStr){stColor=hexStr;hex.value=hexStr;setChip();st.color=stColor}
 function drawHue(){const w=hb.width=180,h=hb.height=12,g=hbx.createLinearGradient(0,0,w,0);["#f00","#ff0","#0f0","#0ff","#00f","#f0f","#f00"].forEach((c,i)=>g.addColorStop(i/6,c));hbx.fillStyle=g;hbx.fillRect(0,0,w,h);hbx.fillStyle="#fff";hbx.fillRect((HSV.h/360)*w-1,0,2,h)}
 function drawSV(){const w=sv.width=180,h=sv.height=120,hx=HSVtoHEX(HSV.h,1,1),g1=svx.createLinearGradient(0,0,w,0);g1.addColorStop(0,"#fff");g1.addColorStop(1,hx);svx.fillStyle=g1;svx.fillRect(0,0,w,h);const g2=svx.createLinearGradient(0,0,0,h);g2.addColorStop(0,"rgba(0,0,0,0)");g2.addColorStop(1,"rgba(0,0,0,1)");svx.fillStyle=g2;svx.fillRect(0,0,w,h);const x=HSV.s*w,y=(1-HSV.v)*h;svx.strokeStyle="#000";svx.lineWidth=2;svx.beginPath();svx.arc(x,y,5,0,Math.PI*2);svx.stroke();svx.strokeStyle="#fff";svx.lineWidth=1;svx.beginPath();svx.arc(x,y,5,0,Math.PI*2);svx.stroke()}
 const syncPickerFromHex=()=>{HSV=HEXtoHSV(stColor);drawHue();drawSV()};
 function setFromSV(e){const r=sv.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));HSV.s=x;HSV.v=1-y;setColor(HSVtoHEX(HSV.h,HSV.s,HSV.v));drawSV()}
 function setFromHue(e){const r=hb.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));HSV.h=x*360;drawHue();drawSV();setColor(HSVtoHEX(HSV.h,HSV.s,HSV.v))}
 sv.onmousedown=e=>{setFromSV(e);const mv=ev=>setFromSV(ev),up=()=>{removeEventListener("mousemove",mv);removeEventListener("mouseup",up)};addEventListener("mousemove",mv);addEventListener("mouseup",up)};
 hb.onmousedown=e=>{setFromHue(e);const mv=ev=>setFromHue(ev),up=()=>{removeEventListener("mousemove",mv);removeEventListener("mouseup",up)};addEventListener("mousemove",mv);addEventListener("mouseup",up)};
 hex.oninput=()=>{const v=hex.value.trim();if(/^#?[0-9a-fA-F]{6}$/.test(v.replace('#',''))){setColor('#'+v.replace('#','').toLowerCase());syncPickerFromHex()}};
 chip.onclick=()=>{sv.style.display=sv.style.display==='none'?'block':'none'};

 /* -------------------------- Settings color picker ------------------------- */
 function initRgbPicker(hex0){let H2=HEXtoHSV(hex0);chip2.style.background=hex0;
  const cH=rgbH.getContext("2d"),cS=rgbSV.getContext("2d");
  function drawH(){const w=rgbH.width=180,h=rgbH.height=12,g=cH.createLinearGradient(0,0,w,0);["#f00","#ff0","#0f0","#0ff","#00f","#f0f","#f00"].forEach((col,i)=>g.addColorStop(i/6,col));cH.fillStyle=g;cH.fillRect(0,0,w,h);cH.fillStyle="#fff";cH.fillRect((H2.h/360)*w-1,0,2,h)}
  function drawS(){const w=rgbSV.width=180,h=rgbSV.height=120,hx=HSVtoHEX(H2.h,1,1),g1=cS.createLinearGradient(0,0,w,0);g1.addColorStop(0,"#fff");g1.addColorStop(1,hx);cS.fillStyle=g1;cS.fillRect(0,0,w,h);const g2=cS.createLinearGradient(0,0,0,h);g2.addColorStop(0,"rgba(0,0,0,0)");g2.addColorStop(1,"rgba(0,0,0,1)");cS.fillStyle=g2;cS.fillRect(0,0,w,h);const x=H2.s*w,y=(1-H2.v)*h;cS.strokeStyle="#000";cS.lineWidth=2;cS.beginPath();cS.arc(x,y,5,0,Math.PI*2);cS.stroke();cS.strokeStyle="#fff";cS.lineWidth=1;cS.beginPath();cS.arc(x,y,5,0,Math.PI*2);cS.stroke()}
  function pickSV(e){const r=rgbSV.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));H2.s=x;H2.v=1-y;rgbHEX.value=HSVtoHEX(H2.h,H2.s,H2.v);chip2.style.background=rgbHEX.value;applyRGB("static",rgbHEX.value);markDirty();drawS()}
  function pickH(e){const r=rgbH.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));H2.h=x*360;rgbHEX.value=HSVtoHEX(H2.h,H2.s,H2.v);chip2.style.background=rgbHEX.value;applyRGB("static",rgbHEX.value);markDirty();drawH();drawS()}
  drawH();drawS();rgbHEX.value=hex0;
  rgbSV.onmousedown=e=>{pickSV(e);const mv=ev=>pickSV(ev),up=()=>{removeEventListener("mousemove",mv);removeEventListener("mouseup",up)};addEventListener("mousemove",mv);addEventListener("mouseup",up)};
  rgbH.onmousedown =e=>{pickH(e); const mv=ev=>pickH(ev), up=()=>{removeEventListener("mousemove",mv);removeEventListener("mouseup",up)}; addEventListener("mousemove",mv); addEventListener("mouseup",up)};
  rgbHEX.oninput=()=>{const v=rgbHEX.value.trim();if(/^#?[0-9a-fA-F]{6}$/.test(v.replace('#',''))){chip2.style.background='#'+v.replace('#','').toLowerCase();applyRGB("static",chip2.style.background);markDirty()}}
 }

 /* ------------------------------- Editor state ----------------------------- */
 const st={tool:"hand",size:+sizeEl.value,color:"#ff0000",strength:+strengthEl.value,drawing:false,start:null,undo:[],redo:[],zoom:1,panX:0,panY:0,orig:null,base:null,sharpBase:null,preview:false,ghost:{on:false,x:0,y:0,val:""},placing:null,filename:"unknown.png",filebytes:0,prev:{w:0,h:0,bytes:0},rgbMode:"dynamic",rgbStatic:"#00aaff",rgbSpeed:1,hdrMode:"auto",hdrActive:"SDR",textOutline:false,inject:{attachments:true,viewer:true,misc:false},dirty:false};

 /* Slider fill backgrounds */
 setColor("#ff0000");syncPickerFromHex();
 const setFill=el=>{const min=+el.min,max=+el.max,val=+el.value;el.style.setProperty('--pos',((val-min)/(max-min))*100+'%')};[sizeEl,strengthEl,speedEl].forEach(el=>{["input","change"].forEach(t=>el.addEventListener(t,()=>setFill(el)));setFill(el)});

 /* Info bar helpers */
 const human=n=>n>1e9?(n/1e9).toFixed(2)+" GB":n>1e6?(n/1e6).toFixed(2)+" MB":n>1e3?(n/1e3).toFixed(1)+" KB":n+" B";
 const setInfo=()=>{infoName.textContent=st.filename;infoRes.textContent=`${cv.width}×${cv.height}`;infoSize.textContent=st.filebytes?human(st.filebytes):"—";infoBadge.textContent=st.hdrActive};
 const updateSizeFromCanvas=async()=>{try{const blob=await new Promise(r=>cv.toBlob(r,"image/png"));st.filebytes=blob?.size||0;setInfo()}catch{}};

 /* -------------------------- RGB border glow logic ------------------------- */
 function applyGlowAnimation(){if(st.rgbMode!=='dynamic'){borderGlow.style.animation='';return}
  const hueDur=(6/Math.max(0.3,st.rgbSpeed))+'s';
  const breatheDur=(2.3/Math.max(0.3,st.rgbSpeed))+'s';
  borderGlow.style.animation=`eu-rgb-hue ${hueDur} linear infinite,eu-rgb-breathe ${breatheDur} ease-in-out infinite`;
 }
 function setGlowBase(){if(st.rgbMode==='off'){borderGlow.style.display='none';return}
  borderGlow.style.display='block';
  if(st.rgbMode==='static'){borderGlow.style.filter='none';borderGlow.style.animation='';borderGlow.style.boxShadow=`0 0 26px 14px ${st.rgbStatic}80`}
  else{borderGlow.style.filter='hue-rotate(0deg)';borderGlow.style.boxShadow='0 0 26px 14px rgba(255,0,0,.35)';applyGlowAnimation()}
 }
 /* “Burst” pulse without resetting dynamic animation loop */
 function burst(){const prev=borderGlow.style.boxShadow;let pulse;if(st.rgbMode==='static'){const c=st.rgbStatic.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);pulse=`0 0 36px 22px rgba(${r},${g},${b},.8)`}else{pulse='0 0 36px 22px rgba(255,0,0,.65)'}borderGlow.style.boxShadow=pulse;setTimeout(()=>{borderGlow.style.boxShadow=prev},220)}

 /* ------------------------------- Tool routing ----------------------------- */
 function setTool(name){st.tool=name;qa(".eu-tool",ov).forEach(b=>b.classList.toggle("active",b.dataset.tool===name));
  if(name==="text"){const anchor=qa('.eu-tool[data-tool="text"]',ov)[0];const r=anchor.getBoundingClientRect();textPop.style.left=r.left+"px";textPop.style.top=(r.bottom+6)+"px";textPop.style.display="block"}else{textPop.style.display="none"}
  if(name==="unblurpaint"){const off=document.createElement("canvas");off.width=cv.width;off.height=cv.height;const o=off.getContext("2d");o.filter=`blur(${Math.round(24*Math.max(.15,st.strength))}px)`;o.drawImage(st.sharpBase,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(off,0,0);st.base.getContext("2d").drawImage(cv,0,0)}
  ox.canvas.width=cv.width;ox.canvas.height=cv.height;ox.clearRect(0,0,oc.width,oc.height)}
 qa(".eu-tool",ov).forEach(b=>b.addEventListener("click",()=>setTool(b.dataset.tool)));setTool("hand");
 textOutlineBtn.onclick=()=>{st.textOutline=!st.textOutline;textOutlineBtn.style.outline=st.textOutline?'2px solid var(--brand-experiment,#5865f2)':'none'};

 /* Show trash only when composer has attachments */
 const refreshTrashVisibility=()=>trashBtn.style.display=composerHasAttachments()?"":"none";new MutationObserver(refreshTrashVisibility).observe(getComposer(),{subtree:true,childList:true,attributes:true});refreshTrashVisibility();

 /* ------------------------------ Canvas sizing ----------------------------- */
 const pos=e=>{const r=stageWrap.getBoundingClientRect();return{x:(e.clientX-r.left-st.panX)/st.zoom,y:(e.clientY-r.top-st.panY)/st.zoom}};
 const updateTransform=()=>stage.style.transform=`translate(${st.panX}px,${st.panY}px) scale(${st.zoom})`;
 const applyCanvasDimsToDOM=()=>{[oc,cc].forEach(c=>{c.width=cv.width;c.height=cv.height});[cc,cv,oc].forEach(el=>{el.style.width=cv.width+"px";el.style.height=cv.height+"px"});stage.style.width=cv.width+"px";stage.style.height=cv.height+"px";borderGlow.style.width=cv.width+"px";borderGlow.style.height=cv.height+"px";drawChecker()};
 const drawChecker=()=>{const w=cc.width,h=cc.height,sz=16;ccx.clearRect(0,0,w,h);for(let y=0;y<h;y+=sz)for(let x=0;x<w;x+=sz){ccx.fillStyle=((x/sz+y/sz)&1)===0?"#0b0c0f":"#1a1b20";ccx.fillRect(x,y,sz,sz)}};
 function fitZoom(){const pad=24,w=stageWrap.clientWidth-pad,h=stageWrap.clientHeight-pad;const s=Math.max(.05,Math.min(w/cv.width,h/cv.height));st.zoom=s;st.panX=(w-cv.width*s)/2;st.panY=(h-cv.height*s)/2;updateTransform()}
 function fitZoomTwice(){fitZoom();requestAnimationFrame(fitZoom)}
 function initFromImage(img){cv.width=img.width;cv.height=img.height;applyCanvasDimsToDOM();cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0);
  st.orig=document.createElement("canvas");st.orig.width=cv.width;st.orig.height=cv.height;st.orig.getContext("2d").drawImage(cv,0,0);
  st.base=document.createElement("canvas");st.base.width=cv.width;st.base.height=cv.height;st.base.getContext("2d").drawImage(cv,0,0);
  st.sharpBase=document.createElement("canvas");st.sharpBase.width=cv.width;st.sharpBase.height=cv.height;st.sharpBase.getContext("2d").drawImage(cv,0,0);
  st.filename="unknown.png";st.filebytes=0;setInfo();st.undo=[];pushUndo();fitZoomTwice();applyHDRMode();updateSizeFromCanvas();setGlowBase();burst()}
 if(blob){const url=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{initFromImage(img);URL.revokeObjectURL(url)};img.src=url}

 /* ------------------------------ Undo / Redo ------------------------------- */
 const pushUndo=()=>{try{st.undo.push(cv.toDataURL());if(st.undo.length>120)st.undo.shift();st.redo.length=0}catch{}};
 const snap=u=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u});
 const applySnap=async u=>{const i=await snap(u);cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(i,0,0,cv.width,cv.height);st.base.getContext("2d").drawImage(cv,0,0);st.sharpBase.getContext("2d").drawImage(cv,0,0);await updateSizeFromCanvas()};
 undoBtn.onclick=async()=>{if(st.undo.length<2)return;const last=st.undo.pop();st.redo.push(last);await applySnap(st.undo.at(-1))};
 redoBtn.onclick=async()=>{if(!st.redo.length)return;const u=st.redo.pop();st.undo.push(u);await applySnap(u)};
 resetBtn.onclick=async()=>{cv.width=st.orig.width;cv.height=st.orig.height;applyCanvasDimsToDOM();cx.drawImage(st.orig,0,0);st.undo=[];st.redo=[];pushUndo();st.base.getContext("2d").drawImage(cv,0,0);st.sharpBase.getContext("2d").drawImage(cv,0,0);fitZoomTwice();await updateSizeFromCanvas();burst()};

 /* ------------------------------- Zoom / Pan ------------------------------- */
 sizeEl.oninput=()=>{st.size=+sizeEl.value};
 strengthEl.oninput=()=>{st.strength=+strengthEl.value; if(st.tool==="unblurpaint"){const off=document.createElement("canvas");off.width=cv.width;off.height=cv.height;const o=off.getContext("2d");o.filter=`blur(${Math.round(24*Math.max(.15,st.strength))}px)`;o.drawImage(st.sharpBase,0,0);cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(off,0,0);st.base.getContext("2d").drawImage(cv,0,0)}};
 function setZoom(z){st.zoom=Math.max(.05,Math.min(6,z));updateTransform();zoomLabel.textContent=Math.round(st.zoom*100)+"%"}
 zoomInBtn.onclick=()=>setZoom(st.zoom*1.1);zoomOutBtn.onclick=()=>setZoom(st.zoom*.9);zoomFitBtn.onclick=()=>fitZoomTwice();
 stageWrap.addEventListener("wheel",e=>{if(!e.ctrlKey)return;e.preventDefault();setZoom(st.zoom*(e.deltaY>0?.9:1.1))},{passive:false});
 let panning=false,ps={x:0,y:0},sp={x:0,y:0};
 stageWrap.onmousedown=e=>{if(st.tool!=="hand"||st.placing)return;panning=true;ps={x:e.clientX,y:e.clientY};sp={x:st.panX,y:st.panY};e.preventDefault()};
 addEventListener("mousemove",e=>{if(!panning)return;st.panX=sp.x+(e.clientX-ps.x);st.panY=sp.y+(e.clientY-ps.y);updateTransform()});
 addEventListener("mouseup",()=>{panning=false});

 /* ---------------------------- Drawing & overlay --------------------------- */
 let lastCursor={x:0,y:0};
 const drawRing=p=>{ox.save();ox.strokeStyle="rgba(59,130,246,.85)";ox.lineWidth=1;ox.beginPath();ox.arc(p.x,p.y,st.size/2,0,Math.PI*2);ox.stroke();ox.restore()};
 const drawArrow=(ctx,a,b)=>{const L=Math.max(12,st.size*2.4),ang=Math.atan2(b.y-a.y,b.x-a.x),ux=Math.cos(ang),uy=Math.sin(ang),ex=b.x-ux*L*.9,ey=b.y-uy*L*.9;ctx.save();ctx.strokeStyle=rgba(st.color,st.strength);ctx.fillStyle=rgba(st.color,st.strength);ctx.lineWidth=st.size;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(ex,ey);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-L*Math.cos(ang-Math.PI/6),b.y-L*Math.sin(ang-Math.PI/6));ctx.lineTo(b.x-L*Math.cos(ang+Math.PI/6),b.y-L*Math.sin(ang+Math.PI/6));ctx.closePath();ctx.fill();ctx.restore()};
 const textFont=()=>`bold ${Math.max(8,st.size*2.2)}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`;

 function renderOverlay(){ox.canvas.width=cv.width;ox.canvas.height=cv.height;ox.clearRect(0,0,oc.width,oc.height);
  if(st.placing){ox.save();ox.globalAlpha=.95;ox.drawImage(st.placing.img,st.placing.x,st.placing.y,st.placing.w,st.placing.h);ox.setLineDash([6,4]);ox.lineWidth=1;ox.strokeStyle="#69f";ox.strokeRect(st.placing.x,st.placing.y,st.placing.w,st.placing.h);ox.restore();return}
  if(["brush","eraser","blurpaint","unblurpaint"].includes(st.tool))drawRing(lastCursor);
  if(st.tool==="text"&&st.ghost.on){ox.save();if(st.textOutline){ox.strokeStyle="#000";ox.lineWidth=3;ox.font=textFont();ox.textBaseline="middle";ox.strokeText(st.ghost.val||textInput.value||"",st.ghost.x,st.ghost.y)}ox.fillStyle=rgba(st.color,st.strength);ox.font=textFont();ox.textAlign="left";ox.textBaseline="middle";const t=(st.ghost.val||textInput.value||"");if(t)ox.fillText(t,st.ghost.x,st.ghost.y);ox.restore()}
  if(st.preview&&st.tool==="rect"){ox.setLineDash([6,4]);ox.lineWidth=1;ox.strokeStyle=rgba(st.color,st.strength);const x=Math.min(st.start.x,lastCursor.x),y=Math.min(st.start.y,lastCursor.y),w=Math.abs(lastCursor.x-st.start.x),h=Math.abs(lastCursor.y-st.start.y);ox.strokeRect(x,y,w,h)}
  if(st.preview&&st.tool==="circle"){const cx0=(st.start.x+lastCursor.x)/2,cy0=(st.start.y+lastCursor.y)/2,rx=Math.abs(lastCursor.x-st.start.x)/2,ry=Math.abs(lastCursor.y-st.start.y)/2;ox.beginPath();ox.ellipse(cx0,cy0,rx,ry,0,0,Math.PI*2);ox.strokeStyle=rgba(st.color,st.strength);ox.lineWidth=1;ox.setLineDash([6,4]);ox.stroke()}
  if(st.preview&&st.tool==="crop"){const x=Math.min(st.start.x,lastCursor.x),y=Math.min(st.start.y,lastCursor.y),w=Math.abs(lastCursor.x-st.start.x),h=Math.abs(lastCursor.y-st.start.y);ox.fillStyle="rgba(0,0,0,.55)";ox.fillRect(0,0,oc.width,oc.height);ox.globalCompositeOperation="destination-out";ox.fillRect(x,y,w,h);ox.globalCompositeOperation="source-over";ox.strokeStyle="#00ff7f";ox.setLineDash([4,3]);ox.lineWidth=1;ox.strokeRect(x,y,w,h)}
  if(st.preview&&st.tool==="arrow"){drawArrow(ox,st.start,lastCursor)}
 }
 textInput.oninput=()=>{st.ghost.val=textInput.value;st.ghost.on=st.tool==="text";renderOverlay()};
 emojiBtn.onclick=()=>{emojiPickerButton()?.click()};

 /* ----------------------------- Paste placement ---------------------------- */
 function enterPlace(img){let w=img.width,h=img.height;const s=Math.min(cv.width*.9/w,cv.height*.9/h,1);w=Math.round(w*s);h=Math.round(h*s);st.placing={img,x:(cv.width-w)/2,y:(cv.height-h)/2,w,h,dx:0,dy:0,drag:false};placeBar.style.display="flex";renderOverlay()}
 function exitPlace(commit){if(commit&&st.placing){pushUndo();cx.save();cx.drawImage(st.placing.img,st.placing.x,st.placing.y,st.placing.w,st.placing.h);cx.restore();st.base.getContext("2d").drawImage(cv,0,0);st.sharpBase.getContext("2d").drawImage(cv,0,0);updateSizeFromCanvas();burst()}st.placing=null;placeBar.style.display="none";renderOverlay()}
 placeOk.onclick=()=>exitPlace(true);placeCancel.onclick=()=>exitPlace(false);

 /* ------------------------------- Pointer I/O ------------------------------ */
 stage.onmousemove=e=>{const p=pos(e);lastCursor=p;if(st.tool==="text"){st.ghost.on=true;st.ghost.x=p.x;st.ghost.y=p.y}
  if(st.placing){if(st.placing.drag){st.placing.x=p.x-st.placing.dx;st.placing.y=p.y-st.placing.dy}renderOverlay();return}
  if(st.drawing&&(st.tool==="brush"||st.tool==="eraser")){cx.lineTo(p.x,p.y);cx.stroke()}
  else if(st.drawing&&st.tool==="blurpaint"){const r=Math.max(2,st.size/2),d=r*2;cx.save();cx.beginPath();cx.arc(p.x,p.y,r,0,Math.PI*2);cx.clip();cx.filter=`blur(${Math.round(24*st.strength)}px)`;cx.drawImage(cv,p.x-r,p.y-r,d,d,p.x-r,p.y-r,d,d);cx.restore()}
  else if(st.drawing&&st.tool==="unblurpaint"){const r=Math.max(2,st.size/2),d=r*2;cx.save();cx.beginPath();cx.arc(p.x,p.y,r,0,Math.PI*2);cx.clip();cx.globalAlpha=Math.max(.05,st.strength);cx.drawImage(st.sharpBase,p.x-r,p.y-r,d,d,p.x-r,p.y-r,d,d);cx.restore()}
  renderOverlay()};
 stage.onmousedown=e=>{const p=pos(e);st.start=p;
  if(st.placing){const hit=p.x>=st.placing.x&&p.x<=st.placing.x+st.placing.w&&p.y>=st.placing.y&&p.y<=st.placing.y+st.placing.h;if(hit){st.placing.drag=true;st.placing.dx=p.x-st.placing.x;st.placing.dy=p.y-st.placing.y}return}
  if(st.tool==="hand")return;
  if(st.tool==="text"){const val=(textInput.value||"").trim();if(val){pushUndo();cx.save();if(st.textOutline){cx.strokeStyle="#000";cx.lineWidth=3;cx.font=textFont();cx.textBaseline="middle";cx.strokeText(val,p.x,p.y)}cx.fillStyle=rgba(st.color,st.strength);cx.font=textFont();cx.textAlign="left";cx.textBaseline="middle";cx.fillText(val,p.x,p.y);cx.restore();st.base.getContext("2d").drawImage(cv,0,0);st.sharpBase.getContext("2d").drawImage(cv,0,0);updateSizeFromCanvas();burst()}return}
  if(st.tool==="brush"||st.tool==="eraser"){st.drawing=true;cx.save();cx.lineCap="round";cx.lineJoin="round";cx.lineWidth=st.size;if(st.tool==="eraser"){cx.globalCompositeOperation="destination-out";cx.strokeStyle=`rgba(0,0,0,${st.strength})`}else{cx.globalCompositeOperation="source-over";cx.strokeStyle=rgba(st.color,st.strength)}cx.beginPath();cx.moveTo(p.x,p.y)}
  else if(st.tool==="blurpaint"||st.tool==="unblurpaint"){st.drawing=true}
  else if(["arrow","rect","crop","circle"].includes(st.tool)){st.preview=true;renderOverlay()}};
 addEventListener("mouseup",async e=>{if(st.placing){st.placing.drag=false;renderOverlay();return}
  if(!st.start)return;const r=stageWrap.getBoundingClientRect(),p={x:(e.clientX-r.left-st.panX)/st.zoom,y:(e.clientY-r.top-st.panY)/st.zoom};
  if(st.drawing){if(st.tool==="brush"||st.tool==="eraser"){cx.lineTo(p.x,p.y);cx.stroke()}st.drawing=false;cx.closePath?.();cx.restore?.();pushUndo();st.base.getContext("2d").drawImage(cv,0,0);await updateSizeFromCanvas();burst()}
  else if(st.tool==="arrow"){drawArrow(cx,st.start,p);pushUndo();st.base.getContext("2d").drawImage(cv,0,0);await updateSizeFromCanvas();burst()}
  else if(st.tool==="rect"){const x=Math.min(st.start.x,p.x),y=Math.min(st.start.y,p.y),w=Math.abs(p.x-st.start.x),h=Math.abs(p.y-st.start.y);cx.save();cx.strokeStyle=rgba(st.color,st.strength);cx.lineWidth=st.size;cx.strokeRect(x,y,w,h);cx.restore();pushUndo();st.base.getContext("2d").drawImage(cv,0,0);await updateSizeFromCanvas();burst()}
  else if(st.tool==="circle"){const cx0=(st.start.x+p.x)/2,cy0=(st.start.y+p.y)/2,rx=Math.abs(p.x-st.start.x)/2,ry=Math.abs(p.y-st.start.y)/2;cx.save();cx.strokeStyle=rgba(st.color,st.strength);cx.lineWidth=st.size;cx.beginPath();cx.ellipse(cx0,cy0,rx,ry,0,0,Math.PI*2);cx.stroke();cx.restore();pushUndo();st.base.getContext("2d").drawImage(cv,0,0);await updateSizeFromCanvas();burst()}
  else if(st.tool==="crop"){const x=Math.min(st.start.x,p.x),y=Math.min(st.start.y,p.y),w=Math.max(1,Math.abs(p.x-st.start.x)),h=Math.max(1,Math.abs(p.y-st.start.y));const t=document.createElement("canvas");t.width=w;t.height=h;t.getContext("2d").drawImage(cv,x,y,w,h,0,0,w,h);cv.width=w;cv.height=h;applyCanvasDimsToDOM();cx.clearRect(0,0,w,h);cx.drawImage(t,0,0);pushUndo();st.base.getContext("2d").drawImage(cv,0,0);st.sharpBase.getContext("2d").drawImage(cv,0,0);fitZoomTwice();setInfo();await updateSizeFromCanvas();burst()}
  st.start=null;st.preview=false;renderOverlay()});

 /* ------------------------------- HDR handling ----------------------------- */
 const toneMapSDR=()=>{const w=cv.width,h=cv.height,id=cx.getImageData(0,0,w,h),a=id.data;for(let i=0;i<a.length;i+=4){let r=a[i]/255,g=a[i+1]/255,b=a[i+2]/255;r=r/(1+r);g=g/(1+g);b=b/(1+b);r=Math.pow(r,1/1.05);g=Math.pow(g,1/1.05);b=Math.pow(b,1/1.05);a[i]=(r*255)|0;a[i+1]=(g*255)|0;a[i+2]=(b*255)|0}cx.putImageData(id,0,0)};
 const boostHDRLook=()=>{const w=cv.width,h=cv.height,id=cx.getImageData(0,0,w,h),a=id.data;for(let i=0;i<a.length;i+=4){let r=a[i]/255,g=a[i+1]/255,b=a[i+2]/255;r=Math.pow(r,.9);g=Math.pow(g,.9);b=Math.pow(b,.9);const l=.2126*r+.7152*g+.0722*b;r=r*1.08+l*(-.08);g=g*1.08+l*(-.08);b=b*1.08+l*(-.08);a[i]=(Math.max(0,Math.min(1,r))*255)|0;a[i+1]=(Math.max(0,Math.min(1,g))*255)|0;a[i+2]=(Math.max(0,Math.min(1,b))*255)|0}cx.putImageData(id,0,0)};
 function applyHDRMode(){cx.clearRect(0,0,cv.width,cv.height);cx.drawImage(st.sharpBase,0,0);if(st.hdrMode==='sdr'){toneMapSDR();st.hdrActive="SDR"}else if(st.hdrMode==='hdr'){boostHDRLook();st.hdrActive="HDR"}else{st.hdrActive="SDR"}st.base.getContext("2d").drawImage(cv,0,0);setInfo()}

 /* ------------------------------- Settings UI ------------------------------ */
 const toggleSettings=()=>{const r=settingsBtn.getBoundingClientRect();settingsPop.style.left=r.left+"px";settingsPop.style.top=r.bottom+6+"px";settingsPop.style.display=settingsPop.style.display==='block'?'none':'block'};
 settingsBtn.onclick=()=>{rgbPickerWrap.style.display=st.rgbMode==='static'?'block':'none';if(st.rgbMode==='static')initRgbPicker(st.rgbStatic);speedEl.value=st.rgbSpeed;setFill(speedEl);refreshSaveBtn();toggleSettings()};
 settingsPop.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.rgb){applyRGB(t.dataset.rgb);markDirty()}if(t.dataset.hdr){st.hdrMode=t.dataset.hdr;applyHDRMode();markDirty()}});
 function applyRGB(mode,color){st.rgbMode=mode;if(mode==='off'){borderGlow.style.display='none';rgbPickerWrap.style.display='none'}
  else if(mode==='static'){st.rgbStatic=color||rgbHEX.value||st.rgbStatic;rgbPickerWrap.style.display='block';initRgbPicker(st.rgbStatic);setGlowBase()}
  else{rgbPickerWrap.style.display='none';setGlowBase()}}
 speedEl.oninput=()=>{st.rgbSpeed=+speedEl.value;applyGlowAnimation();markDirty()};

 /* Injection toggles (Attachments / Viewer / Misc) */
 swAttach.onchange=()=>{st.inject.attachments=swAttach.checked;sweepEnhance();markDirty()};
 swViewer.onchange=()=>{st.inject.viewer=swViewer.checked;sweepEnhance();markDirty()};
 swMisc.onchange =()=>{st.inject.misc=swMisc.checked;sweepEnhance();markDirty()};

 function markDirty(){st.dirty=true;saveSettingsBtn.textContent="Save";saveSettingsBtn.classList.add("eu-green")}
 function refreshSaveBtn(){if(st.dirty){saveSettingsBtn.textContent="Save";saveSettingsBtn.classList.add("eu-green")}else{saveSettingsBtn.textContent="Saved";saveSettingsBtn.classList.remove("eu-green")}}

 /* ----------------------------- Rename + I/O ------------------------------- */
 const showRenamePop=a=>{const r=a.getBoundingClientRect();renamePop.style.left=r.left+"px";renamePop.style.top=r.bottom+6+"px";renamePop.style.display="block";renameInput.value=st.filename||"unknown.png";setTimeout(()=>renameInput.focus(),0)};
 const hideRenamePop=()=>renamePop.style.display="none";infoBar.onclick=()=>showRenamePop(infoBar);
 renameOk.onclick=()=>{const v=renameInput.value.trim();if(v){st.filename=v;setInfo()}hideRenamePop()};renameCancel.onclick=hideRenamePop;

 /* Download current canvas as PNG (uses current filename) */
 const doDownload=async()=>{const blob=await new Promise(r=>cv.toBlob(r,"image/png"));const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=st.filename||"unknown.png";document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},0)};dlBtn.onclick=doDownload;

 /* Save/Send helpers */
 const toPNGBlob=()=>new Promise(r=>cv.toBlob(r,"image/png"));
 const saveToQueue=async()=>{const blob=await toPNGBlob();const f=new File([blob],st.filename||"unknown.png",{type:"image/png",lastModified:Date.now()});injectFile(f)};
 const doSend=async()=>{await saveToQueue();setTimeout(()=>sendNow(),40);setTimeout(closeAndCleanup,60)};
 const doSave=async({send=false}={})=>{try{if(send){await doSend();return}if(EXTRA_DELETE_ON_SAVE)purgeComposer();await saveToQueue();await updateSizeFromCanvas();burst()}catch(e){}};
 saveBtn.onclick=()=>doSave();sendBtn.onclick=()=>doSave({send:true});
 trashBtn.onclick=()=>{const b=firstRemoveAttachmentBtn();if(b){b.click();setTimeout(()=>refreshTrashVisibility(),60)}};closeBtn.onclick=closeAndCleanup;

 /* ------------------------------ Persist config ---------------------------- */
 function loadCfg(){try{const j=localStorage.getItem("EU_cfg");if(!j)return;const c=JSON.parse(j);if(c.rgbMode)st.rgbMode=c.rgbMode;if(c.rgbStatic)st.rgbStatic=c.rgbStatic;if(typeof c.rgbSpeed==="number")st.rgbSpeed=c.rgbSpeed;if(c.hdrMode)st.hdrMode=c.hdrMode;if(c.inject){st.inject={...st.inject,...c.inject}}
  swAttach.checked=!!st.inject.attachments;swViewer.checked=!!st.inject.viewer;swMisc.checked=!!st.inject.misc;speedEl.value=st.rgbSpeed;setFill(speedEl);setGlowBase();applyHDRMode();applyGlowAnimation();window.__EU_INJECT_STATE__={...st.inject};sweepEnhance()}catch{}}
 function saveCfg(){try{const cfg={rgbMode:st.rgbMode,rgbStatic:st.rgbStatic,hdrMode:st.hdrMode,inject:st.inject,rgbSpeed:st.rgbSpeed};localStorage.setItem("EU_cfg",JSON.stringify(cfg));window.__EU_INJECT_STATE__={...st.inject};st.dirty=false;refreshSaveBtn()}catch{}}
 loadCfg();
 saveSettingsBtn.onclick=()=>{saveCfg()};
 addEventListener("click",e=>{if(settingsPop.style.display==='block' && !e.target.closest?.('#eu-settings-pop,#eu-settings')){settingsPop.style.display='none'}});

 /* --------------------------- Paste into editor ---------------------------- */
 const onPaste=e=>{const items=e.clipboardData?.items||[];for(const it of items){if(it.type&&it.type.startsWith("image/")){e.preventDefault();const blob=it.getAsFile(),u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{enterPlace(img);URL.revokeObjectURL(u)};img.src=u;return}}};ov.addEventListener("paste",onPaste,{capture:true});
 function closeAndCleanup(){ov.removeEventListener("paste",onPaste,true);ov.remove()}
}

/* -------------------------- Inline button + tooltip ------------------------ */
/* Build a small inline “Edit” button for tiles/viewer with native-style tip */
const makeEditButton=()=>{const b=document.createElement('button');b.type="button";b.setAttribute("aria-label",BTN_ARIA);b.dataset.euTip=BTN_ARIA; b.innerHTML=ICON.pencil; attachNativeTip(b); return b};
/* Lightweight tooltip (matches Discord timing/feel) */
function attachNativeTip(el){
  let tip=null,tid=null;
  const show=()=>{
    if(tip) return;
    tip=document.createElement('div');tip.className='eu-tip';tip.textContent=el.dataset.euTip||'';
    document.body.appendChild(tip);
    const r=el.getBoundingClientRect(),tr=tip.getBoundingClientRect();
    tip.style.left=Math.round(r.left + r.width/2 - tr.width/2)+'px';
    tip.style.top =Math.round(r.top - tr.height - 8)+'px';
    requestAnimationFrame(()=>tip.classList.add('show'));
  };
  const hide=()=>{if(!tip) return; tip.classList.remove('show'); const t=tip; tip=null; setTimeout(()=>t.remove(),130)};
  el.addEventListener('mouseenter',()=>{tid=setTimeout(show,250)});
  el.addEventListener('mouseleave',()=>{clearTimeout(tid);hide()});
  el.addEventListener('blur',hide);
}

/* ------------------------------- Tile enhance ------------------------------ */
/* Attach “Edit” to composer upload tiles */
function enhanceComposerTile(tile){
  if(tile.dataset.euEnhanced==="1") return;
  const trash = tile.querySelector('button[aria-label*="Remove"],button[aria-label*="Delete"],[aria-label="Remove Attachment"]');
  if(!trash) return;
  const row = trash.parentElement||tile;
  if(row.querySelector(`button[aria-label="${BTN_ARIA}"]`)) { tile.dataset.euEnhanced="1"; return; }
  const btn = makeEditButton();
  btn.addEventListener("click",(e)=>{e.preventDefault();e.stopPropagation();handleEditFromTile(tile)});
  trash.insertAdjacentElement("beforebegin", btn);
  tile.dataset.euEnhanced="1";
}

/* ------------------------------ Viewer enhance ----------------------------- */
/* Add “Edit” to image viewer dialogs (near Open/Download actions) */
function enhanceViewerDialog(dlg){
  if(dlg.dataset.euEnhanced==="1") return;
  const base=dlg.querySelector('button[aria-label*="Open"],button[aria-label*="View"],button[aria-label*="Download"],[aria-label*="Save"],[aria-label*="Copy"]');
  if(!base) return;
  const btn=makeEditButton(); btn.style.marginLeft="6px";
  btn.addEventListener("click",async (e)=>{e.preventDefault();e.stopPropagation();
    const img=biggestNonAvatarImg(dlg); if(!img) return;
    const url=resolveFullsizeFromImg(img); if(!url) return;
    try{const r=await fetch(url,{mode:"cors"}); if(r.ok){const b=await r.blob(); openEditorWithBlob(b);} }catch{}
  });
  base.parentElement.appendChild(btn);
  dlg.dataset.euEnhanced="1";
}

/* ------------------------------- Tile handler ------------------------------ */
/* On composer tile click, try to find underlying File/Blob; fallback to fetch */
async function handleEditFromTile(tile){
  let file=null,node=tile;
  for(let i=0;i<8&&node;i++,node=node.parentElement){
    const f=fiber(node); if(!f) continue; let z=f;
    for(let j=0;j<10&&z;j++,z=z.return){
      const p=z?.memoizedProps||z?.pendingProps; const found=deepFindFile(p); if(found){file=found;break}
    }
    if(file) break;
  }
  if(!file){
    const img=biggestNonAvatarImg(tile)||biggestNonAvatarImg(document);
    if(img){const url=resolveFullsizeFromImg(img); if(url){try{const r=await fetch(url,{mode:"cors"}); if(r.ok) file=await r.blob()}catch{}}}
  }
  if(!file){alert("Couldn't read image");return}
  if(DELETE_ON_EDIT) setTimeout(()=>purgeComposer(),0);
  openEditorWithBlob(file);
}

/* ------------------------------- Injection ctrl ---------------------------- */
/* User-configurable edit button injection across contexts */
let injectState={attachments:true,viewer:true,misc:false};
function allowedForButton(el){
  const inUpload=!!el.closest?.('[class*="upload"],[class*="attachment"]');
  const inDialog=!!el.closest?.('div[role="dialog"]');
  if(inUpload) return injectState.attachments;
  if(inDialog) return injectState.viewer;
  return injectState.misc;
}
/* Periodic sweep: attach/remove edit buttons as needed */
function sweepEnhance(){
  const root=getComposer();
  injectState = window.__EU_INJECT_STATE__ || injectState;
  if(root && injectState.attachments) qa('[class*="upload"],[class*="attachment"]',root).forEach(enhanceComposerTile);
  if(injectState.viewer) qa('div[role="dialog"]').forEach(d=>{if(d.querySelector('img')) enhanceViewerDialog(d)});
  qa(`button[aria-label="${BTN_ARIA}"]`).forEach(b=>{if(!allowedForButton(b)){b.remove()} else {if(!b.dataset.euTip) {b.dataset.euTip=BTN_ARIA; attachNativeTip(b)}}});
}
/* Observe dynamic DOM; enhance on-the-fly */
const obs=new MutationObserver(muts=>{for(const m of muts){for(const n of m.addedNodes){if(!(n instanceof Element)) continue;
  const root=getComposer(); if(root&&root.contains(n)&&injectState.attachments){
    n.matches && n.matches('[class*="upload"],[class*="attachment"]') && enhanceComposerTile(n);
    n.querySelectorAll?.('[class*="upload"],[class*="attachment"]').forEach(enhanceComposerTile);
  }
  if(injectState.viewer && n.getAttribute?.('role')==='dialog'&&n.querySelector?.('img')) enhanceViewerDialog(n);
}}});
obs.observe(document.body,{childList:true,subtree:true});
setTimeout(sweepEnhance,200);setTimeout(sweepEnhance,800);setInterval(sweepEnhance,3500);

/* ------------------------------- Global paste ------------------------------ */
/* Paste from anywhere → new editor, unless already open */
document.addEventListener("paste",e=>{if(!CAPTURE_PASTE_ALWAYS||q('#eu-overlay'))return;const items=e.clipboardData?.items||[];for(const it of items){if(it.type&&it.type.startsWith("image/")){e.preventDefault();openEditorWithBlob(it.getAsFile());return}}},{capture:true});

/* ------------------------------- Public surface ---------------------------- */
/* Minimal API to toggle injection externally (debug/QA tooling) */
Object.defineProperty(window,'__EU_SET_INJECT__',{value:(a,v)=>{injectState[a]=!!v;window.__EU_INJECT_STATE__=injectState;sweepEnhance();},writable:false});
})();

