(() => {
  /* EditUploadsV1 — lightweight image editor, native web discord.
     Notes:
       • Written as a zero-dependency console userscript for portability (BetterDiscord / Vencord ports later).
       • Uses DOM-only APIs and query-by-aria to stay resilient to className churn.
       • Keep comments practical for future maintainers; no change logs or version notes embedded here. */

  const BTN_ARIA = "Edit Upload (EU)";
  const LAUNCHER_ARIA = "Open Editor (Blank)";
  const DELETE_ON_EDIT = true;
  const EXTRA_DELETE_ON_SAVE = true;
  const CAPTURE_PASTE_ALWAYS = true;
  const SUPPORT_URL = "https://discord.gg/SADyYHbWn5";

  const DEFAULT_BLANK_W = 1920, DEFAULT_BLANK_H = 1080;

  // --- small helpers ---
  const q=(s,p=document)=>p.querySelector(s);
  const qa=(s,p=document)=>Array.from(p.querySelectorAll(s));
  const rgba=(hex,a=1)=>{const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)||[];return`rgba(${parseInt(m[1]||"ff",16)},${parseInt(m[2]||"00",16)},${parseInt(m[3]||"00",16)},${a})`};
  const log=(...a)=>console.log("%cEditUploadsV1","padding:2px 6px;background:#5865f2;color:#fff;border-radius:4px",...a);
  function fiber(n){for(const k in n) if(k.startsWith("__reactFiber$")) return n[k]}
  function deepFindFile(x,s=new WeakSet()){
    if(!x||typeof x!=="object"||s.has(x))return null; s.add(x);
    if((x instanceof File||x instanceof Blob)&&/^image\//.test(x.type||""))return x;
    if(x.item?.file&&(x.item.file instanceof File||x.item.file instanceof Blob))return x.item.file;
    if(x.file&&(x.file instanceof File||x instanceof Blob))return x.file;
    if(Array.isArray(x)){ for(const v of x){ const r=deepFindFile(v,s); if(r)return r; } }
    else{ for(const k of Object.keys(x)){ const r=deepFindFile(x[k],s); if(r)return r; } }
    return null;
  }
  function cloneByAriaIncludes(list){
    for(const text of list){
      const btn = qa(`button[aria-label*="${text}"],div[aria-label*="${text}"]`).find(b=>b.offsetParent!==null);
      const svg = btn?.querySelector?.("svg"); if(svg) return svg.outerHTML;
    }
    return null;
  }

  // try reusing Discord’s own icons first (keeps the look native)
  const nativeZoomIn  = cloneByAriaIncludes(["Zoom In","Zoom in","+"]);
  const nativeZoomOut = cloneByAriaIncludes(["Zoom Out","Zoom out","-"]);
  const nativeClose   = cloneByAriaIncludes(["Close","close","Dismiss"]);
  const nativeUndo    = cloneByAriaIncludes(["Undo","undo"]);
  const nativeRedo    = cloneByAriaIncludes(["Redo","redo"]);
  const nativeSend    = cloneByAriaIncludes(["Send Message","Send"]);
  const nativeTrash   = cloneByAriaIncludes(["Remove Attachment","Remove","Delete"]);
  const nativeHelp    = cloneByAriaIncludes(["Help","help","Support"]);

  const ICON = {
    send:  nativeSend || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 21l21-9L2 3v7l14 2L2 14z"/></svg>`,
    close: nativeClose || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>`,
    trash: nativeTrash || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 3v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5V3zM11 7h2v11h-2z"/></svg>`,
    zoomIn:  nativeZoomIn  || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.93-2.27l.27.28v.79l5 5 1.5-1.5-5-5M9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14"/><path fill="currentColor" d="M10 7v2h2v1h-2v2H9v-2H7V9h2V7z"/></svg>`,
    zoomOut: nativeZoomOut || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 9.5 16a6.5 6.5 0 0 0 4.93-2.27l.27.28v.79l5 5 1.5-1.5-5-5M9.5 14A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14M7 9h5v1H7z"/></svg>`,
    fit:     `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h6V2H2v8h2V4m8-2v2h6v6h2V2m-2 18h-6v2h8v-8h-2v6M4 14H2v8h8v-2H4v-6Z"/></svg>`,
    dl:      `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2Zm7-18-5 5h3v6h4V7h3l-5-5Z"/></svg>`,
    brush:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M14.1 3.9 20.1 9.9 9 21H3v-6l11.1-11.1z"/></svg>`,
    eraser:  `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M16.24 3.56 21 8.32l-9.19 9.19H7.05L3 13.46l9.19-9.9a2 2 0 0 1 2.83 0z"/></svg>`,
    arrow:   `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 12h14.17l-4.59-4.59L13 6l7 7-7 7-1.41-1.41L16.17 14H2v-2Z"/></svg>`,
    rect:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v14H3V5m2 2v10h14V7H5Z"/></svg>`,
    circle:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
    text:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 6V4h16v2h-7v14h-2V6H4z"/></svg>`,
    crop:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 3h2v2H7v3H5V5a2 2 0 0 1 2-2Zm10 0a2 2 0 0 1 2 2v2h-2V5h-3V3h3ZM7 21a2 2 0 0 1-2-2v-2h2v2h3v2H7Zm10 0h-3v-2h3v-3h2v3a2 2 0 0 1-2 2Z"/></svg>`,
    blur:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3s7 7.58 7 11a7 7 0 0 1-14 0c0-3.42 7-11 7-11"/></svg>`,
    unblur:  `<svg viewBox="0 0 24 24"><g stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c0 0 7 7.6 7 11a7 7 0 0 1-7 7 7 7 0 0 1-7-7c0-3.4 7-11 7-11"/><path d="M5 5l14 14"/></g></svg>`,
    hand:    `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 11V6a1 1 0 0 1 2 0v4h1V5a1 1 0 0 1 2 0v5h1V6a1 1 0 1 1 2 0v6h1V9a1 1 0 1 1 2 0v6c0 3-2 5-5 5H9c-2.2 0-4-1.8-4-4v-5a1 1 0 0 1 2 0v4z"/></svg>`,
    undo:    nativeUndo || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7V3L6 9l6 6v-4c3.3 0 5.7 1.3 7 4-1-5-4-8-7-8z"/></svg>`,
    redo:    nativeRedo || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 7c-3 0-6 3-7 8 1.3-2.7 3.7-4 7-4v4l6-6-6-6v4z"/></svg>`,
    help:    nativeHelp || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92A3.5 3.5 0 0 0 13 14h-2v-.5c0-1 .5-1.5 1.1-2.1l1.2-1.2a1.9 1.9 0 1 0-3.3-1.35H8a4 4 0 1 1 7.07 2.4z"/></svg>`
  };

  const getComposer=()=>q('form[aria-label*="Message"],form[aria-label*="message"]') || document;

  function firstRemoveAttachmentBtn() {
    const root = getComposer();
    const sel = [
      'div[role="dialog"] [aria-label="Remove Attachment"]',
      '[class*="upload"] [aria-label="Remove Attachment"]',
      '[class*="attachment"] [aria-label="Remove Attachment"]',
      'button[aria-label="Remove"]',
      'button[aria-label="Delete"]'
    ].join(',');
    return qa(sel, root).find(b => b.offsetParent !== null) || null;
  }
  function emojiPickerButton() {
    const root = getComposer();
    const candidates = qa('button[aria-label*="Emoji"],button[aria-label*="emoji"]', root);
    return candidates.find(b => b.offsetParent !== null) || null;
  }
  function composerHasText(){ const box=q('[role="textbox"]', getComposer()); return !!(box?.textContent?.trim()?.length); }
  function composerHasAttachments(){ return !!firstRemoveAttachmentBtn(); }

  function sendNow(){
    const root = getComposer();
    const btn = qa([
      'button[aria-label="Send Message"]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      '[data-testid="send-button"]',
      '[class*="buttons"] button[aria-label*="Send"]'
    ].join(','), root).find(b=>b.offsetParent!==null);
    const clickSeq = (el)=>{ const o={bubbles:true,cancelable:true,view:window};
      el.dispatchEvent(new MouseEvent('mousemove',o));
      el.dispatchEvent(new MouseEvent('mousedown',o));
      el.dispatchEvent(new MouseEvent('mouseup',o));
      el.dispatchEvent(new MouseEvent('click',o));
    };
    if (btn) { clickSeq(btn); return true; }
    const box=q('[role="textbox"]', root);
    if(box){
      box.focus();
      const k=(t)=>new KeyboardEvent(t,{key:"Enter",code:"Enter",which:13,keyCode:13,bubbles:true,cancelable:true,composed:true});
      box.dispatchEvent(k('keydown')); box.dispatchEvent(k('keypress')); box.dispatchEvent(k('keyup')); return true;
    }
    const form = getComposer(); if(form){ form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); return true; }
    return false;
  }

  function purgeComposer(){
    let rounds = 0;
    const tick = () => {
      let hit = false;
      qa([
        'button[aria-label="Remove"]',
        'button[aria-label="Delete"]',
        'button[aria-label*="Remove Attachment"]',
        '[data-list-item-id^="chat-messages"] button[aria-label*="Remove"]',
        '[class*="upload"] button[aria-label*="Remove"]',
        '[class*="attachment"] button[aria-label*="Remove"]'
      ].join(','), getComposer()).forEach(b => { (b.offsetParent !== null) && (b.click(), hit=true); });
      qa('[aria-label="Close"],[aria-label*="Close"]', getComposer())
        .filter(b=>b.closest('[class*="replyBar"],[class*="attachedBars"],[class*="upload"]'))
        .forEach(b=>{ b.click(); hit=true; });
      const box=q('[role="textbox"]', getComposer());
      if(box){
        const sel=window.getSelection(); const r=document.createRange();
        r.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(r);
        document.execCommand("delete");
        box.dispatchEvent(new InputEvent("input",{bubbles:true,cancelable:true,inputType:"deleteContentBackward"}));
      }
      if(hit && rounds++ < 20) setTimeout(tick, 80);
    };
    tick();
  }

  function injectFile(file){
    const i=q('input[type="file"]', getComposer()) || q('input[type="file"]');
    if(!i) return false;
    const dt=new DataTransfer(); dt.items.add(file); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }

  function normalizeCDN(url){
    if(!url) return null;
    try{
      const u = new URL(url, location.href);
      if(u.hostname.includes("media.discordapp.net")) u.hostname = "cdn.discordapp.com";
      ["width","height","quality","format"].forEach(k=>u.searchParams.delete(k));
      return u.toString();
    }catch{ return url; }
  }
  function fromSrcSet(img){
    const set = img.getAttribute("srcset");
    if(!set) return null;
    const parts = set.split(",").map(s=>s.trim().split(" ")[0]).filter(Boolean);
    if(!parts.length) return null;
    return parts[parts.length-1];
  }
  function resolveFullsizeFromImg(img){
    const a = img.closest('a[href]');
    if(a && /discordapp\.(com|net)/.test(a.href)) return normalizeCDN(a.href);
    const ss = fromSrcSet(img); if(ss) return normalizeCDN(ss);
    return normalizeCDN(img.currentSrc||img.src||"");
  }

  // --- styles (panel, toolbar, stage, glow) ---
  if(!q('#eu-editpanel-style-21')){
    const st=document.createElement('style'); st.id='eu-editpanel-style-21'; st.textContent=`
      #eu-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000000;display:flex;align-items:center;justify-content:center}
      #eu-panel{width:min(96vw,1200px);height:min(96vh,820px);background:var(--background-primary,#2b2d31);border:1px solid var(--background-modifier-accent,#3f4147);border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,.55);display:grid;grid-template-rows:auto auto 1fr;overflow:hidden;color:var(--text-normal,#dbdee1)}
      #eu-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--background-tertiary,#1e1f22);color:var(--header-primary,#fff);font-weight:700;border-bottom:1px solid var(--background-modifier-accent,#3f4147)}
      #eu-left{display:flex;align-items:center;gap:10px}
      #eu-title{font-weight:700;margin-right:8px}
      #eu-support{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;cursor:pointer}
      #eu-support svg{width:18px;height:18px;color:var(--brand-experiment,#5865f2)!important;fill:var(--brand-experiment,#5865f2)!important}
      .eu-btn{background:var(--button-secondary-background,#313338);color:var(--interactive-normal);border:1px solid var(--background-modifier-accent,#3f4147);padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:6px;justify-content:center;line-height:18px}
      .eu-btn:hover{background:var(--button-secondary-background-hover,#3a3c41);color:var(--interactive-active)}
      .eu-btn svg{width:18px;height:18px;color:currentColor;fill:currentColor}
      .eu-primary{background:var(--brand-experiment,#5865f2);border:none;color:#fff}
      .eu-green{background:#23a559;border:none;color:#fff}
      .eu-danger{background:#da373c;border:none;color:#fff}
      #eu-right{display:flex;align-items:center}
      #eu-actions{display:flex;align-items:center;gap:8px}

      #eu-zoombar{display:flex;align-items:center;gap:6px}
      #eu-zoombar .eu-btn.icon{width:34px;height:34px}

      #eu-infobar-wrap{flex:1;display:flex;justify-content:center}
      #eu-infobar{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--text-muted);max-width:60%;min-width:220px;overflow:hidden;white-space:nowrap;cursor:pointer}
      #eu-info-name{overflow:hidden;text-overflow:ellipsis;max-width:60%}
      #eu-info-name:hover{animation:eu-marquee 8s linear infinite}
      @keyframes eu-marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }

      #eu-info-size-wrap{position:relative;display:inline-block}
      #eu-info-size{display:inline-block;padding:0 6px;border-radius:4px}
      .eu-pulse-red{animation:eu-pulse-red 1.1s}
      .eu-pulse-green{animation:eu-pulse-green 1.1s}
      @keyframes eu-pulse-red{0%{box-shadow:0 0 32px 8px rgba(255,64,64,.95)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
      @keyframes eu-pulse-green{0%{box-shadow:0 0 32px 8px rgba(35,165,89,.95)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
      .eu-shake{animation:eu-shake 0.5s ease-in-out}
      @keyframes eu-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}

      .eu-toolbar{display:grid;grid-template-columns:auto 1fr 1fr;gap:16px;padding:10px 12px;background:var(--background-secondary,#2b2d31);border-bottom:1px solid var(--background-modifier-accent,#3f4147);align-items:start}
      #eu-color-wrap{display:flex;flex-direction:column;gap:8px}
      .eu-label{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px}
      #eu-chip{width:18px;height:18px;border-radius:4px;border:1px solid var(--background-modifier-accent);cursor:pointer;display:inline-block}
      #eu-ncp-h{width:180px;height:12px;border-radius:6px;border:1px solid var(--background-modifier-accent);overflow:hidden}
      #eu-ncp-hex{width:180px;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-accent);background:var(--input-background,#2b2d31);color:var(--text-normal)}
      #eu-ncp-sv{width:180px;height:120px;border-radius:8px;overflow:hidden;position:relative;border:1px solid var(--background-modifier-accent);display:none}

      #eu-sliders{display:flex;flex-direction:column;gap:10px}
      .eu-col{display:flex;flex-direction:column;gap:6px}
      .eu-range{width:260px;height:18px;-webkit-appearance:none;background:transparent}
      .eu-range::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:
           linear-gradient(var(--brand-experiment,#5865f2),var(--brand-experiment,#5865f2)) 0/var(--pos,0%) 100% no-repeat,
           var(--background-modifier-accent,#3f4147)}
      .eu-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--brand-experiment,#5865f2);margin-top:-5px}
      .eu-range::-moz-range-track{height:4px;border-radius:4px;background:var(--background-modifier-accent,#3f4147)}
      .eu-range::-moz-range-progress{height:4px;border-radius:4px;background:var(--brand-experiment,#5865f2)}
      .eu-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--brand-experiment,#5865f2)}

      #eu-tools{display:grid;grid-template-columns:repeat(9,34px);grid-auto-rows:34px;gap:8px;align-items:center;justify-content:flex-end}
      .eu-tool,.eu-btn.icon{width:34px;height:34px}
      .eu-tool{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--background-modifier-accent);background:var(--button-secondary-background);color:var(--interactive-normal)}
      .eu-tool svg{width:18px;height:18px}
      .eu-tool.active,.eu-tool:hover{outline:2px solid var(--brand-experiment,#5865f2);color:var(--interactive-active)}
      #eu-undo,#eu-redo,#eu-reset{width:40px;height:34px}
      #eu-undo svg,#eu-redo svg{width:26px;height:26px}

      #eu-stage-wrap{display:flex;align-items:center;justify-content:center;position:relative;overflow:auto;scrollbar-width:none;background:#101115}
      #eu-stage-wrap::-webkit-scrollbar{width:0;height:0}
      #eu-stage{position:relative;transform-origin:center center;}
      #eu-cc{position:absolute;left:0;top:0;z-index:0;display:block}
      #eu-cv{position:relative;z-index:1;display:block;background:transparent;border:2px dashed rgba(255,255,255,.35)}
      #eu-overlay-cv{position:absolute;left:0;top:0;pointer-events:none;z-index:2}

      /* RGB glow: single layer that sits around the border (no second dotted line).
         It breathes continuously and hue-rotates. The glow is kept OUTSIDE the image
         (no inset shadow), so content stays clean. */
      #eu-borderglow{
        position:absolute;left:0;top:0;width:100%;height:100%;
        pointer-events:none;border-radius:6px;z-index:2;
        box-shadow:0 0 26px 14px rgba(255,0,0,.35);
        filter:hue-rotate(0deg);
        animation:eu-rgb-hue 6s linear infinite, eu-rgb-breathe 2.3s ease-in-out infinite;
      }

      /* One-shot “burst” to amp the glow (used on open & after crop).
         It ramps up once and fades back to the steady breathing state. */
      #eu-borderglow.eu-burst{
        animation:
          eu-rgb-hue 6s linear infinite,
          eu-rgb-breathe 2.3s ease-in-out infinite,
          eu-burst 900ms ease-out 1;
      }
      @keyframes eu-burst{
        0%   { box-shadow:0 0 60px 28px rgba(255,0,0,.75); opacity:1 }
        100% { box-shadow:0 0 26px 14px rgba(255,0,0,.35); opacity:.95 }
      }

      @keyframes eu-rgb-hue{from{filter:hue-rotate(0)}to{filter:hue-rotate(360deg)}}
      @keyframes eu-rgb-breathe{0%,100%{opacity:.88}50%{opacity:1}}

      .eu-pop{position:absolute;display:none;z-index:5;min-width:280px;max-width:420px;background:var(--background-floating,#111214);
        border:1px solid var(--background-modifier-accent);border-radius:8px;padding:8px;box-shadow:0 12px 24px rgba(0,0,0,.5)}
      .eu-pop input{width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--background-modifier-accent);background:var(--input-background,#2b2d31);color:var(--text-normal)}
      .eu-pop .row{display:flex;gap:6px;align-items:center;margin-top:6px}
      .eu-pop .row .eu-btn{height:34px}

      [aria-label="${BTN_ARIA}"] svg, [aria-label="${LAUNCHER_ARIA}"] svg { color: var(--brand-experiment,#5865f2)!important; fill: var(--brand-experiment,#5865f2)!important; }
    `; document.head.appendChild(st);
  }

  // --- panel ---
  function openEditorWithBlob(blobOrFile){
    const ov=document.createElement('div');
    ov.id='eu-overlay';
    ov.innerHTML=`
      <div id="eu-panel" role="dialog" aria-modal="true" aria-label="EditUploadsV1">
        <div id="eu-hdr">
          <div id="eu-left">
            <a id="eu-support" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer" title="Support / Invite">${ICON.help}</a>
            <div id="eu-title">EditUploadsV1</div>
            <div id="eu-zoombar">
              <button class="eu-btn icon" id="eu-zoom-out" title="Zoom out">${ICON.zoomOut}</button>
              <button class="eu-btn icon" id="eu-zoom-in" title="Zoom in">${ICON.zoomIn}</button>
              <div id="eu-zoom-label">100%</div>
              <button class="eu-btn icon" id="eu-zoom-fit" title="Fit">${ICON.fit}</button>
              <button class="eu-btn icon" id="eu-download" title="Download">${ICON.dl}</button>
            </div>
          </div>
          <div id="eu-infobar-wrap">
            <div id="eu-infobar" title="Click to rename">
              <span id="eu-info-name">—</span>
              <span>•</span>
              <span id="eu-info-res">—</span>
              <span>•</span>
              <span id="eu-info-size-wrap"><span id="eu-info-size">—</span></span>
            </div>
          </div>
          <div id="eu-right">
            <div id="eu-actions">
              <button class="eu-btn eu-danger"  id="eu-trash" title="Remove first attachment">${ICON.trash}<span>&nbsp;Remove</span></button>
              <button class="eu-btn eu-primary" id="eu-send"  title="Send now">${ICON.send}<span>&nbsp;Send</span></button>
              <button class="eu-btn eu-green"   id="eu-save"  title="Save to queue">✔<span>&nbsp;Save</span></button>
              <button class="eu-btn" id="eu-close" title="Close (X)">${ICON.close}<span>&nbsp;Close</span></button>
            </div>
          </div>
        </div>

        <div class="eu-toolbar">
          <div id="eu-color-wrap">
            <div class="eu-label">Color <span id="eu-chip"></span></div>
            <canvas id="eu-ncp-h"></canvas>
            <input id="eu-ncp-hex" placeholder="# ff0000" value="#ff0000">
            <canvas id="eu-ncp-sv"></canvas>
          </div>

          <div id="eu-sliders">
            <div class="eu-col">
              <div class="eu-label">Size</div>
              <input type="range" id="eu-size" class="eu-range" min="2" max="120" value="2">
            </div>
            <div class="eu-col">
              <div class="eu-label">Strength</div>
              <input type="range" id="eu-strength" class="eu-range" min="0" max="1" step="0.05" value="1">
            </div>
          </div>

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

            <div style="grid-column: -4 / -1; display:flex; justify-content:flex-end; gap:8px">
              <button class="eu-btn icon" id="eu-undo" title="Undo">${ICON.undo}</button>
              <button class="eu-btn icon" id="eu-redo" title="Redo">${ICON.redo}</button>
              <button class="eu-btn icon" id="eu-reset" title="Reset">Reset</button>
            </div>

            <div id="eu-placebar" style="grid-column:1 / -1;justify-content:flex-end;display:none;gap:8px">
              <button class="eu-btn eu-green" id="eu-place-ok">✔</button>
              <button class="eu-btn eu-danger" id="eu-place-cancel">✖</button>
            </div>
          </div>

          <div id="eu-text-pop" class="eu-pop">
            <div class="eu-label">Text / Emoji</div>
            <input id="eu-textval" placeholder="Type text…">
            <div class="row">
              <button class="eu-btn" id="eu-emoji-btn" title="Open Discord emoji picker" style="width:34px;height:34px">😀</button>
            </div>
          </div>

          <div id="eu-rename-pop" class="eu-pop">
            <div class="eu-label">Rename file</div>
            <input id="eu-renameval" placeholder="filename.png">
            <div class="row">
              <button class="eu-btn eu-green" id="eu-rename-ok">Confirm</button>
              <button class="eu-btn eu-danger" id="eu-rename-cancel">Cancel</button>
            </div>
          </div>
        </div>

        <div id="eu-stage-wrap">
          <div id="eu-stage">
            <canvas id="eu-cc"></canvas>
            <canvas id="eu-cv"></canvas>
            <canvas id="eu-overlay-cv"></canvas>
            <div id="eu-borderglow"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);

    // trap hotkeys in the overlay
    const stopHotkeys = (e)=>{ e.stopPropagation(); };
    ov.addEventListener("keydown", stopHotkeys, true);
    ov.addEventListener("keypress", stopHotkeys, true);
    ov.addEventListener("keyup", stopHotkeys, true);

    const close=()=>ov.remove();
    ov.addEventListener("click",e=>{ if(!e.target.closest("#eu-panel")) closeAndCleanup(); });
    ov.addEventListener("keydown",e=>{ if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closeAndCleanup(); } }, true);

    // canvas & UI refs
    const stageWrap=q("#eu-stage-wrap",ov), stage=q("#eu-stage",ov),
          cv=q("#eu-cv",ov), cx=cv.getContext("2d",{willReadFrequently:true}),
          oc=q("#eu-overlay-cv",ov), ox=oc.getContext("2d"),
          cc=q("#eu-cc",ov), ccx=cc.getContext("2d",{willReadFrequently:true});
    const borderGlow=q("#eu-borderglow",ov);

    const sizeEl=q("#eu-size",ov), strengthEl=q("#eu-strength",ov);
    const textPop=q("#eu-text-pop",ov), textInput=q("#eu-textval",ov), emojiBtn=q("#eu-emoji-btn",ov);
    const renamePop=q("#eu-rename-pop",ov), renameInput=q("#eu-renameval",ov),
          renameOk=q("#eu-rename-ok",ov), renameCancel=q("#eu-rename-cancel",ov);
    const undoBtn=q("#eu-undo",ov), redoBtn=q("#eu-redo",ov), resetBtn=q("#eu-reset",ov);
    const saveBtn=q("#eu-save",ov), sendBtn=q("#eu-send",ov), trashBtn=q("#eu-trash",ov), closeBtn=q("#eu-close",ov);
    const zoomOutBtn=q("#eu-zoom-out",ov), zoomInBtn=q("#eu-zoom-in",ov), zoomFitBtn=q("#eu-zoom-fit",ov), zoomLabel=q("#eu-zoom-label",ov), dlBtn=q("#eu-download",ov);
    const infoBar=q("#eu-infobar",ov), infoName=q("#eu-info-name",ov), infoRes=q("#eu-info-res",ov),
          infoSizeWrap=q("#eu-info-size-wrap",ov), infoSize=q("#eu-info-size",ov);

    [textInput, renameInput].forEach(inp=>{
      ["keydown","keypress","keyup"].forEach(evt=>inp.addEventListener(evt, e=>e.stopPropagation(), true));
    });

    // color picker (HSV mini)
    const sv=q("#eu-ncp-sv",ov), svx=sv.getContext("2d");
    const hb=q("#eu-ncp-h",ov), hbx=hb.getContext("2d");
    const hex=q("#eu-ncp-hex",ov), chip=q("#eu-chip",ov);
    let HSV={h:0,s:1,v:1}, stColor="#ff0000";
    const HSVtoHEX=(h,s,v)=>{let f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(Math.min(k,4-k,1),0);const r=Math.round(f(5)*255),g=Math.round(f(3)*255),b=Math.round(f(1)*255);return"#"+[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("")}
    function HEXtoHSV(hexStr){const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexStr);if(!m) return HSV;const r=parseInt(m[1],16)/255,g=parseInt(m[2],16)/255,b=parseInt(m[3],16)/255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}const s=max?d/max:0;const v=max;return{h,s,v}}
    const setChip=()=>{ chip.style.background=stColor; };
    function setColor(hexStr){ stColor=hexStr; hex.value=hexStr; setChip(); st.color=stColor; }
    function drawHue(){const w=hb.width=180,h=hb.height=12;const grd=hbx.createLinearGradient(0,0,w,0);grd.addColorStop(0,"#f00");grd.addColorStop(1/6,"#ff0");grd.addColorStop(2/6,"#0f0");grd.addColorStop(3/6,"#0ff");grd.addColorStop(4/6,"#00f");grd.addColorStop(5/6,"#f0f");grd.addColorStop(1,"#f00");hbx.fillStyle=grd;hbx.fillRect(0,0,w,h);const x=(HSV.h/360)*w;hbx.fillStyle="#fff";hbx.fillRect(x-1,0,2,h)}
    function drawSV(){const w=sv.width=180,h=sv.height=120;const hueHex=HSVtoHEX(HSV.h,1,1);const g1=svx.createLinearGradient(0,0,w,0);g1.addColorStop(0,"#fff");g1.addColorStop(1,hueHex);svx.fillStyle=g1;svx.fillRect(0,0,w,h);const g2=svx.createLinearGradient(0,0,0,h);g2.addColorStop(0,"rgba(0,0,0,0)");g2.addColorStop(1,"rgba(0,0,0,1)");svx.fillStyle=g2;svx.fillRect(0,0,w,h);const x=HSV.s*w,y=(1-HSV.v)*h;svx.strokeStyle="#000";svx.lineWidth=2;svx.beginPath();svx.arc(x,y,5,0,Math.PI*2);svx.stroke();svx.strokeStyle="#fff";svx.lineWidth=1;svx.beginPath();svx.arc(x,y,5,0,Math.PI*2);svx.stroke()}
    function syncPickerFromHex(){HSV=HEXtoHSV(stColor);drawHue();drawSV();}
    function setFromSV(ev){const r=sv.getBoundingClientRect(),x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height));HSV.s=x;HSV.v=1-y;setColor(HSVtoHEX(HSV.h,HSV.s,HSV.v));drawSV();}
    function setFromHue(ev){const r=hb.getBoundingClientRect(),x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width));HSV.h=x*360;drawHue();drawSV();setColor(HSVtoHEX(HSV.h,HSV.s,HSV.v));}
    sv.addEventListener("mousedown",e=>{ setFromSV(e); const mv=(ev)=>setFromSV(ev); const up=()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)}; window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up); });
    hb.addEventListener("mousedown",e=>{ setFromHue(e); const mv=(ev)=>setFromHue(ev); const up=()=>{window.removeEventListener("mousemove",mv);window.removeEventListener("mouseup",up)}; window.addEventListener("mousemove",mv); window.addEventListener("mouseup",up); });
    hex.addEventListener("input",()=>{ const v=hex.value.trim(); if(/^#?[0-9a-fA-F]{6}$/.test(v.replace('#',''))){ setColor('#'+v.replace('#','').toLowerCase()); syncPickerFromHex(); } });
    chip.addEventListener('click',()=>{ sv.style.display = sv.style.display==='none' ? 'block' : 'none'; });

    // editor state
    const st={
      tool:"hand", size:+sizeEl.value, color:"#ff0000", strength:+strengthEl.value,
      drawing:false, start:null, undo:[], redo:[], zoom:1,
      orig:null, base:null, sharpBase:null, preview:false,
      ghost:{on:false,x:0,y:0,val:""},
      placing:null,
      filename:"unknown.png", filebytes:0,
      prev:{w:0,h:0,bytes:0}
    };
    setColor("#ff0000"); syncPickerFromHex();

    const setFill=(el)=>{ const min=+el.min, max=+el.max, val=+el.value; el.style.setProperty('--pos', Math.max(0,Math.min(100, ((val-min)/(max-min))*100 ))+'%'); };
    [sizeEl,strengthEl].forEach(el=>{ setFill(el); el.addEventListener('input',()=>setFill(el)); });

    const human=(n)=> n>1e9 ? (n/1e9).toFixed(2)+" GB" : n>1e6 ? (n/1e6).toFixed(2)+" MB" : n>1e3 ? (n/1e3).toFixed(1)+" KB" : n+" B";
    function addEcho(isUp){
      // subtle size-change pulse on the info pill (not the border glow)
      const d=document.createElement('div');
      d.className='eu-echo '+(isUp?'red':'green');
      // style for this is inlined via classes above
      d.style.position='absolute'; d.style.inset='-6px'; d.style.pointerEvents='none';
      infoSizeWrap.appendChild(d);
      d.addEventListener('animationend',()=>d.remove(),{once:true});
    }
    function pulseSizeColor(up){
      infoSize.classList.remove('eu-pulse-red','eu-pulse-green','eu-shake'); void infoSize.offsetWidth;
      infoSize.classList.add(up?'eu-pulse-red':'eu-pulse-green','eu-shake');
      addEcho(up);
      setTimeout(()=>infoSize.classList.remove('eu-pulse-red','eu-pulse-green','eu-shake'),1200);
    }
    function setInfo(){
      infoName.textContent = st.filename;
      infoRes.textContent  = `${cv.width}×${cv.height}`;
      infoSize.textContent = st.filebytes ? human(st.filebytes) : "—";
      st.prev.w=cv.width; st.prev.h=cv.height;
      renameInput.value = st.filename;
    }
    async function updateSizeFromCanvas(){
      try{
        const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
        const prevBytes=st.prev.bytes||0; st.filebytes=blob?.size||0;
        const delta = st.filebytes - prevBytes;
        if(prevBytes && delta){ pulseSizeColor(delta>0); }
        setInfo(); st.prev.bytes=st.filebytes;
      }catch{}
    }

    const doDownload = async () => {
      const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=st.filename || "unknown.png";
      document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
    };
    dlBtn.onclick=doDownload;

    function showRenamePop(anchor){
      const r=anchor.getBoundingClientRect();
      renamePop.style.left=(r.left)+"px";
      renamePop.style.top=(r.bottom+6)+"px";
      renamePop.style.display="block";
      renameInput.value = st.filename || "unknown.png";
      setTimeout(()=>renameInput.focus(),0);
    }
    function hideRenamePop(){ renamePop.style.display="none"; }
    infoBar.onclick = () => showRenamePop(infoBar);
    renameOk.onclick = ()=>{ const v=renameInput.value.trim(); if(v){ st.filename=v; setInfo(); } hideRenamePop(); };
    renameCancel.onclick = ()=> hideRenamePop();

    function setTool(name){
      st.tool=name;
      qa(".eu-tool",ov).forEach(b=>b.classList.toggle("active", b.dataset.tool===name));
      if(name==="text"){
        st.ghost.on=true; st.ghost.val=textInput.value||"";
        const anchor=qa('.eu-tool[data-tool="text"]',ov)[0];
        const r=anchor.getBoundingClientRect();
        textPop.style.left=(r.left)+"px"; textPop.style.top=(r.bottom+6)+"px"; textPop.style.display="block";
        setTimeout(()=>textInput.focus(),0);
      }else{ textPop.style.display="none"; }
      if(name==="unblurpaint") applyGlobalBlur();
      ox.canvas.width=cv.width; ox.canvas.height=cv.height; ox.clearRect(0,0,oc.width,oc.height);
    }
    qa(".eu-tool",ov).forEach(b=> b.addEventListener("click",()=> setTool(b.dataset.tool)));
    setTool("hand");

    function refreshTrashVisibility(){ trashBtn.style.display = firstRemoveAttachmentBtn() ? "" : "none"; }
    const visObs = new MutationObserver(()=>refreshTrashVisibility());
    visObs.observe(getComposer(), {subtree:true, childList:true, attributes:true});
    refreshTrashVisibility();

    function applyCanvasDimsToDOM(){
      oc.width=cv.width; oc.height=cv.height;
      cc.width=cv.width; cc.height=cv.height;
      [cc, cv, oc].forEach(el=>{
        el.style.width=cv.width+"px";
        el.style.height=cv.height+"px";
      });
      stage.style.width=cv.width+"px"; stage.style.height=cv.height+"px";
      if(borderGlow){ borderGlow.style.width=cv.width+"px"; borderGlow.style.height=cv.height+"px"; }
      drawChecker();
    }

    function drawChecker(){
      const w=cc.width, h=cc.height;
      ccx.clearRect(0,0,w,h);
      const sz=16;
      for(let y=0;y<h;y+=sz){
        for(let x=0;x<w;x+=sz){
          const dark=((x/sz + y/sz)&1)===0;
          ccx.fillStyle = dark ? "#0b0c0f" : "#1a1b20";
          ccx.fillRect(x,y,sz,sz);
        }
      }
    }

    // Amp the existing glow once (no separate shape, no inward pulse)
    function triggerGlowBurst(){
      borderGlow.classList.remove('eu-burst'); void borderGlow.offsetWidth;
      borderGlow.classList.add('eu-burst');
      setTimeout(()=>borderGlow.classList.remove('eu-burst'), 950);
    }

    function initFromImage(img, fit=true){
      cv.width=img.width; cv.height=img.height;
      applyCanvasDimsToDOM();
      cx.clearRect(0,0,cv.width,cv.height); cx.drawImage(img,0,0);
      st.orig=document.createElement("canvas"); st.orig.width=cv.width; st.orig.height=cv.height; st.orig.getContext("2d").drawImage(cv,0,0);
      st.base=document.createElement("canvas"); st.base.width=cv.width; st.base.height=cv.height; st.base.getContext("2d").drawImage(cv,0,0);
      st.sharpBase=document.createElement("canvas"); st.sharpBase.width=cv.width; st.sharpBase.height=cv.height; st.sharpBase.getContext("2d").drawImage(cv,0,0);
      st.filename="unknown.png"; st.filebytes=0; setInfo();
      st.undo=[]; pushUndo();
      if(fit){ fitZoom(); requestAnimationFrame(()=>fitZoom()); } else { setZoom(1); }
      updateSizeFromCanvas();
      triggerGlowBurst();
    }

    if(blobOrFile){
      const url=URL.createObjectURL(blobOrFile);
      const img=new Image();
      img.onload=()=>{ initFromImage(img, true); URL.revokeObjectURL(url); };
      img.src=url;
    }else{
      const blank=document.createElement("canvas"); blank.width=DEFAULT_BLANK_W; blank.height=DEFAULT_BLANK_H;
      const img=new Image(); img.onload=()=>initFromImage(img, true);
      img.src=blank.toDataURL("image/png");
    }

    const pushUndo=()=>{ try{ st.undo.push(cv.toDataURL()); if(st.undo.length>120) st.undo.shift(); st.redo.length=0; }catch{} };
    const snap=(u)=>new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=u; });
    async function applySnap(u){ const i=await snap(u); cx.clearRect(0,0,cv.width,cv.height); cx.drawImage(i,0,0,cv.width,cv.height); st.base.getContext("2d").drawImage(cv,0,0); st.sharpBase.getContext("2d").drawImage(cv,0,0); await updateSizeFromCanvas(); }
    undoBtn.onclick=async()=>{ if(st.undo.length<2) return; const last=st.undo.pop(); st.redo.push(last); await applySnap(st.undo.at(-1)); };
    redoBtn.onclick=async()=>{ if(!st.redo.length) return; const u=st.redo.pop(); st.undo.push(u); await applySnap(u); };
    async function resetAll(){ cv.width=st.orig.width; cv.height=st.orig.height; applyCanvasDimsToDOM();
      cx.clearRect(0,0,cv.width,cv.height); cx.drawImage(st.orig,0,0);
      st.undo=[]; st.redo=[]; pushUndo(); st.base.getContext("2d").drawImage(cv,0,0); st.sharpBase.getContext("2d").drawImage(cv,0,0);
      fitZoom(); setInfo(); await updateSizeFromCanvas(); triggerGlowBurst(); }
    resetBtn.onclick=resetAll;

    sizeEl.oninput = ()=>{ st.size=+sizeEl.value; if(st.tool==="text"){ st.ghost.on=true; renderOverlay(); } };
    strengthEl.oninput= ()=>{ st.strength=+strengthEl.value; if(st.tool==="unblurpaint") applyGlobalBlur(); if(st.tool==="text"){ st.ghost.on=true; renderOverlay(); } };

    function setZoom(z){ st.zoom=Math.max(0.05,Math.min(6,z)); stage.style.transform=`scale(${st.zoom})`; zoomLabel.textContent=Math.round(st.zoom*100)+"%"; }
    function fitZoom(){
      // True fit to viewport (no 150% cap).
      const pad=24, w=stageWrap.clientWidth-pad, h=stageWrap.clientHeight-pad;
      const fitScale = Math.max(0.05, Math.min(w/cv.width, h/cv.height));
      setZoom(fitScale);
    }

    zoomInBtn.onclick = ()=> setZoom(st.zoom*1.1);
    zoomOutBtn.onclick = ()=> setZoom(st.zoom*0.9);
    zoomFitBtn.onclick = ()=> fitZoom();

    stageWrap.addEventListener("wheel",e=>{ if(!e.ctrlKey) return; e.preventDefault(); setZoom(st.zoom*(e.deltaY>0?0.9:1.1)); },{passive:false});
    let panning=false, ps={x:0,y:0}, ss={l:0,t:0};
    stageWrap.addEventListener("mousedown",e=>{ if(st.tool!=="hand" || st.placing) return; panning=true; ps={x:e.clientX,y:e.clientY}; ss={l:stageWrap.scrollLeft,t:stageWrap.scrollTop}; e.preventDefault(); });
    window.addEventListener("mousemove",e=>{ if(!panning) return; stageWrap.scrollLeft=ss.l-(e.clientX-ps.x); stageWrap.scrollTop=ss.t-(e.clientY-ps.y); });
    window.addEventListener("mouseup",()=>{ panning=false; });

    const pos=e=>{ const r=stage.getBoundingClientRect(); return {x:(e.clientX-r.left)/st.zoom, y:(e.clientY-r.top)/st.zoom}; };
    let lastCursor={x:0,y:0};

    function drawRing(p){ ox.save(); ox.strokeStyle="rgba(59,130,246,.85)"; ox.lineWidth=1; ox.beginPath(); ox.arc(p.x,p.y,st.size/2,0,Math.PI*2); ox.stroke(); ox.restore(); }
    function applyGlobalBlur(){
      const off=document.createElement("canvas"); off.width=cv.width; off.height=cv.height; const o=off.getContext("2d");
      const px = Math.round(24*Math.max(.15, st.strength));
      o.filter=`blur(${px}px)`; o.drawImage(st.sharpBase,0,0);
      cx.clearRect(0,0,cv.width,cv.height); cx.drawImage(off,0,0);
      st.base.getContext("2d").drawImage(cv,0,0);
    }

    function drawArrow(ctx,a,b){
      const headLen = Math.max(12, st.size*2.4);
      const ang = Math.atan2(b.y-a.y, b.x-a.x);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const endX = b.x - ux*headLen*0.9;
      const endY = b.y - uy*headLen*0.9;
      ctx.save();
      ctx.strokeStyle=rgba(st.color,st.strength);
      ctx.fillStyle=rgba(st.color,st.strength);
      ctx.lineWidth=st.size;
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(a.x,a.y);
      ctx.lineTo(endX,endY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - headLen*Math.cos(ang - Math.PI/6), b.y - headLen*Math.sin(ang - Math.PI/6));
      ctx.lineTo(b.x - headLen*Math.cos(ang + Math.PI/6), b.y - headLen*Math.sin(ang + Math.PI/6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const textFont=()=>`bold ${Math.max(8,st.size*2.2)}px system-ui,-apple-system,Segoe UI,Roboto,sans-serif`;

    function renderOverlay(){
      ox.canvas.width=cv.width; ox.canvas.height=cv.height;
      ox.clearRect(0,0,oc.width,oc.height);
      if(st.placing){
        ox.save(); ox.globalAlpha=0.95;
        ox.drawImage(st.placing.img, st.placing.x, st.placing.y, st.placing.w, st.placing.h);
        ox.setLineDash([6,4]); ox.lineWidth=1; ox.strokeStyle="#69f";
        ox.strokeRect(st.placing.x, st.placing.y, st.placing.w, st.placing.h);
        ox.restore();
        return;
      }
      if(["brush","eraser","blurpaint","unblurpaint"].includes(st.tool)) drawRing(lastCursor);
      if(st.tool==="text" && st.ghost.on){
        ox.save(); ox.fillStyle=rgba(st.color,st.strength); ox.font=textFont(); ox.textAlign="left"; ox.textBaseline="middle";
        const text=(st.ghost.val||textInput.value||""); if(text) ox.fillText(text,st.ghost.x,st.ghost.y);
        ox.restore();
      }
      if(st.preview && st.tool==="rect"){
        ox.save(); ox.setLineDash([6,4]); ox.lineWidth=1; ox.strokeStyle=rgba(st.color,st.strength);
        const x=Math.min(st.start.x,lastCursor.x), y=Math.min(st.start.y,lastCursor.y), w=Math.abs(lastCursor.x-st.start.x), h=Math.abs(lastCursor.y-st.start.y); ox.strokeRect(x,y,w,h); ox.restore();
      }
      if(st.preview && st.tool==="circle"){
        ox.save(); ox.setLineDash([6,4]); ox.lineWidth=1; ox.strokeStyle=rgba(st.color,st.strength);
        const cx0=(st.start.x+lastCursor.x)/2, cy0=(st.start.y+lastCursor.y)/2;
        const rx=Math.abs(lastCursor.x-st.start.x)/2, ry=Math.abs(lastCursor.y-st.start.y)/2;
        ox.beginPath(); ox.ellipse(cx0,cy0,rx,ry,0,0,Math.PI*2); ox.stroke(); ox.restore();
      }
      if(st.preview && st.tool==="crop"){
        const x=Math.min(st.start.x,lastCursor.x), y=Math.min(st.start.y,lastCursor.y), w=Math.abs(lastCursor.x-st.start.x), h=Math.abs(lastCursor.y-st.start.y);
        ox.save();
        ox.fillStyle="rgba(0,0,0,0.55)"; ox.fillRect(0,0,oc.width,oc.height);
        ox.globalCompositeOperation="destination-out"; ox.fillRect(x,y,w,h);
        ox.globalCompositeOperation="source-over";
        ox.setLineDash([4,3]); ox.lineWidth=1; ox.strokeStyle="#00ff7f";
        ox.strokeRect(x,y,w,h);
        ox.restore();
      }
      if(st.preview && st.tool==="arrow"){ drawArrow(ox, st.start, lastCursor); }
    }

    textInput.oninput=()=>{ st.ghost.val = st.textVal = textInput.value; if(st.tool==="text"){ st.ghost.on=true; st.ghost.x=lastCursor.x; st.ghost.y=lastCursor.y; renderOverlay(); } };
    emojiBtn.onclick=()=>{ const b = emojiPickerButton(); if (b) b.click(); };

    function enterPlace(img){
      const w=Math.min(img.width, cv.width), h=Math.min(img.height, cv.height);
      st.placing={img, x:(cv.width-w)/2, y:(cv.height-h)/2, w, h, dx:0, dy:0, drag:false};
      q("#eu-placebar",ov).style.display="flex";
      setTool("hand");
      renderOverlay();
    }
    function exitPlace(commit){
      if(commit && st.placing){
        pushUndo(); cx.drawImage(st.placing.img, st.placing.x, st.placing.y, st.placing.w, st.placing.h);
        st.base.getContext("2d").drawImage(cv,0,0); st.sharpBase.getContext("2d").drawImage(cv,0,0); updateSizeFromCanvas();
      }
      st.placing=null; q("#eu-placebar",ov).style.display="none"; renderOverlay();
    }
    q("#eu-place-ok",ov).onclick=()=>exitPlace(true);
    q("#eu-place-cancel",ov).onclick=()=>exitPlace(false);

    stage.addEventListener("mousemove",e=>{
      const p=pos(e); lastCursor=p;
      if(st.tool==="text"){ st.ghost.on=true; st.ghost.x=p.x; st.ghost.y=p.y; }
      if(st.placing){
        if(st.placing.drag){ st.placing.x = p.x - st.placing.dx; st.placing.y = p.y - st.placing.dy; }
        renderOverlay(); return;
      }
      if(st.drawing && (st.tool==="brush"||st.tool==="eraser")){
        cx.lineTo(p.x,p.y); cx.stroke();
      } else if(st.drawing && st.tool==="blurpaint"){
        const r=Math.max(2,st.size/2),d=r*2; cx.save(); cx.beginPath(); cx.arc(p.x,p.y,r,0,Math.PI*2); cx.clip();
        cx.filter=`blur(${Math.round(24*st.strength)}px)`; cx.drawImage(cv,p.x-r,p.y-r,d,d,p.x-r,p.y-r,d,d); cx.restore();
      } else if(st.drawing && st.tool==="unblurpaint"){
        const r=Math.max(2,st.size/2),d=r*2; cx.save(); cx.beginPath(); cx.arc(p.x,p.y,r,0,Math.PI*2); cx.clip();
        cx.globalAlpha=Math.max(.05,st.strength); cx.drawImage(st.sharpBase,p.x-r,p.y-r,d,d,p.x-r,p.y-r,d,d); cx.restore();
      }
      renderOverlay();
    });

    stage.addEventListener("mousedown",e=>{
      const p=pos(e); st.start=p;
      if(st.placing){
        const hit = p.x>=st.placing.x && p.x<=st.placing.x+st.placing.w && p.y>=st.placing.y && p.y<=st.placing.y+st.placing.h;
        if(hit){ st.placing.drag=true; st.placing.dx=p.x-st.placing.x; st.placing.dy=p.y-st.placing.y; }
        return;
      }
      if(st.tool==="hand") return;

      if(st.tool==="text"){
        const val=(textInput.value||"").trim();
        if(val){
          pushUndo();
          cx.save(); cx.fillStyle=rgba(st.color,st.strength); cx.font=textFont(); cx.textAlign="left"; cx.textBaseline="middle"; cx.fillText(val,p.x,p.y); cx.restore();
          st.base.getContext("2d").drawImage(cv,0,0); st.sharpBase.getContext("2d").drawImage(cv,0,0);
          updateSizeFromCanvas();
        }
        return;
      }

      if(st.tool==="brush"||st.tool==="eraser"){
        st.drawing=true; cx.save(); cx.lineCap="round"; cx.lineJoin="round"; cx.lineWidth=st.size;
        if(st.tool==="eraser"){ cx.globalCompositeOperation="destination-out"; cx.strokeStyle=`rgba(0,0,0,${st.strength})`; }
        else { cx.globalCompositeOperation="source-over"; cx.strokeStyle=rgba(st.color,st.strength); }
        cx.beginPath(); cx.moveTo(p.x,p.y);
      } else if(st.tool==="blurpaint"||st.tool==="unblurpaint"){ st.drawing=true; }
      else if(st.tool==="arrow"||st.tool==="rect"||st.tool==="crop"||st.tool==="circle"){ st.preview=true; renderOverlay(); }
    });

    window.addEventListener("mouseup",async e=>{
      if(st.placing){ st.placing.drag=false; renderOverlay(); return; }
      if(!st.start) return;
      const r=stage.getBoundingClientRect();
      const p={x:(e.clientX-r.left)/st.zoom, y:(e.clientY-r.top)/st.zoom};
      if(st.drawing){
        if(st.tool==="brush"||st.tool==="eraser"){ cx.lineTo(p.x,p.y); cx.stroke(); }
        st.drawing=false; cx.closePath?.(); cx.restore?.(); pushUndo(); await updateSizeFromCanvas();
      } else if(st.tool==="arrow"){
        drawArrow(cx,st.start,p); pushUndo(); await updateSizeFromCanvas();
      } else if(st.tool==="rect"){
        const x=Math.min(st.start.x,p.x),y=Math.min(st.start.y,p.y),w=Math.abs(p.x-st.start.x),h=Math.abs(p.y-st.start.y);
        cx.save(); cx.strokeStyle=rgba(st.color,st.strength); cx.lineWidth=st.size; cx.strokeRect(x,y,w,h); cx.restore(); pushUndo(); await updateSizeFromCanvas();
      } else if(st.tool==="circle"){
        const cx0=(st.start.x+p.x)/2, cy0=(st.start.y+p.y)/2;
        const rx=Math.abs(p.x-st.start.x)/2, ry=Math.abs(p.y-st.start.y)/2;
        cx.save(); cx.strokeStyle=rgba(st.color,st.strength); cx.lineWidth=st.size; cx.beginPath(); cx.ellipse(cx0,cy0,rx,ry,0,0,Math.PI*2); cx.stroke(); cx.restore(); pushUndo(); await updateSizeFromCanvas();
      } else if(st.tool==="crop"){
        const x=Math.min(st.start.x,p.x),y=Math.min(st.start.y,p.y),w=Math.max(1,Math.abs(p.x-st.start.x)),h=Math.max(1,Math.abs(p.y-st.start.y));
        const t=document.createElement("canvas"); t.width=w; t.height=h; t.getContext("2d").drawImage(cv,x,y,w,h,0,0,w,h);
        cv.width=w; cv.height=h; applyCanvasDimsToDOM();
        cx.clearRect(0,0,w,h); cx.drawImage(t,0,0); pushUndo(); fitZoom(); st.base.getContext("2d").drawImage(cv,0,0); st.sharpBase.getContext("2d").drawImage(cv,0,0);
        setInfo(); await updateSizeFromCanvas();
        // glow burst after crop (resolution change)
        triggerGlowBurst();
      }
      st.start=null; st.preview=false; renderOverlay();
    });

    // paste handling (into overlay)
    const onPaste=(e)=>{
      const items = e.clipboardData?.items || [];
      for(const it of items){
        if(it.type && it.type.startsWith("image/")){
          e.preventDefault();
          const blob = it.getAsFile();
          const url=URL.createObjectURL(blob); const img=new Image();
          img.onload=()=>{ enterPlace(img); URL.revokeObjectURL(url); };
          img.src=url; return;
        }
      }
    };
    ov.addEventListener("paste", onPaste);

    // global paste hook: open editor when pasting an image with no overlay up
    const docPaste=(e)=>{
      if(!CAPTURE_PASTE_ALWAYS) return;
      if(q('#eu-overlay')) return;
      const items = e.clipboardData?.items || [];
      for(const it of items){
        if(it.type && it.type.startsWith("image/")){
          e.preventDefault();
          const blob = it.getAsFile();
          openEditorWithBlob(blob);
          return;
        }
      }
    };
    document.addEventListener("paste", docPaste, {capture:true});

    function closeAndCleanup(){
      document.removeEventListener("paste", docPaste, {capture:true});
      ov.removeEventListener("paste", onPaste);
      ov.remove();
    }

    async function toAnonPNGBlob(){ return await new Promise(r=>cv.toBlob(r,"image/png")); }
    async function saveToQueue(){
      const blob=await toAnonPNGBlob();
      const file=new File([blob], st.filename || "unknown.png",{type:"image/png",lastModified:Date.now()});
      injectFile(file);
    }
    function composerReady(){ return composerHasText() || composerHasAttachments(); }
    async function doSendSmart(){
      if(!composerReady()){
        await saveToQueue();
        let tries=0; while(!composerHasAttachments() && tries<12){ await new Promise(r=>setTimeout(r,100)); tries++; }
      }
      sendNow();
    }
    async function doSave({send=false, keepOpen=false}={}){
      try{
        if(send){ await doSendSmart(); if(!keepOpen) closeAndCleanup(); return; }
        if(EXTRA_DELETE_ON_SAVE) purgeComposer();
        await saveToQueue();
        await updateSizeFromCanvas();
        if(!keepOpen) closeAndCleanup();
      }catch(e){ console.error(e); alert("Couldn't complete action"); }
    }
    saveBtn.onclick=()=>doSave({keepOpen:true});
    sendBtn.onclick=()=>doSave({send:true,keepOpen:false});
    trashBtn.onclick=()=>{ const b = firstRemoveAttachmentBtn(); if (b) { b.click(); setTimeout(()=>trashBtn.style.display = firstRemoveAttachmentBtn()?"":"none", 60); } };
    closeBtn.onclick=closeAndCleanup;
  }

  // discover an image to edit when invoked inline
  function biggestNonAvatarImg(root){
    const imgs = qa('img', root).filter(i=>{
      const cls = (i.className||"")+ " " + (i.parentElement?.className||"");
      const aria = (i.getAttribute('aria-label')||"").toLowerCase();
      return !/avatar|pfp|mask/i.test(cls+aria);
    });
    let best=null, area=0;
    for(const im of imgs){
      const w = im.naturalWidth || im.width || 0;
      const h = im.naturalHeight || im.height || 0;
      if(w*h > area){ area=w*h; best=im; }
    }
    return best;
  }
  function makeInlineClone(base){ const btn=(base?base.cloneNode(true):document.createElement("button")); btn.setAttribute("aria-label",BTN_ARIA); btn.title="Edit Upload"; return btn; }

  async function fetchImageAsBlob(url){
    try{
      const r = await fetch(url, {mode:"cors"});
      if(!r.ok) throw new Error("HTTP "+r.status);
      return await r.blob();
    }catch(e){
      console.warn("Fetch image failed, falling back", e);
      return null;
    }
  }

  async function handleEdit(tile){
    let file=null, node=tile;
    for(let i=0;i<8&&node;i++,node=node.parentElement){
      const f=fiber(node); if(!f) continue; let z=f;
      for(let j=0;j<10&&z;j++,z=z.return){
        const props=z?.memoizedProps||z?.pendingProps;
        const found=deepFindFile(props); if(found){ file=found; break; }
      }
      if(file) break;
    }
    if(!file){
      const imgEl = biggestNonAvatarImg(tile) || biggestNonAvatarImg(document);
      if(imgEl){
        try{
          const fullUrl = resolveFullsizeFromImg(imgEl);
          let blob = null;
          if(fullUrl){ blob = await fetchImageAsBlob(fullUrl); }
          if(!blob){
            const fallback = imgEl.currentSrc || imgEl.src;
            blob = await fetchImageAsBlob(fallback);
          }
          if(blob) file = blob;
        }catch(e){ console.warn("Image fetch error", e); }
      }
    }
    if(!file){ alert("Couldn't read image"); return; }
    if(DELETE_ON_EDIT){ setTimeout(()=>purgeComposer(),0); }
    openEditorWithBlob(file);
  }

  function tileFromNode(n){
    let el=n; for(let i=0;i<10&&el;i++,el=el.parentElement){
      if(el.querySelector?.('button[aria-label*="Remove"],button[aria-label*="Delete"],button[aria-label*="Preview"],button[aria-label*="Open"],button[aria-label*="View"],[aria-label*="Modify"],[aria-label="Edit"]')) return el;
      if(el.getAttribute?.('role')==="dialog" && el.querySelector?.('img')) return el;
    } return n;
  }
  function enhanceTile(tile){
    const pencil = tile.querySelector('button[aria-label="Edit"],[aria-label*="Modify"]');
    const trash  = tile.querySelector('button[aria-label*="Remove"],button[aria-label*="Delete"]');
    const eye    = tile.querySelector('button[aria-label*="Preview"],button[aria-label*="Open"],button[aria-label*="View"]');
    const row = trash?.parentElement || pencil?.parentElement || eye?.parentElement || tile;
    if(!row) return;
    if(row.querySelector(`[aria-label="${BTN_ARIA}"]`)) return;
    const base = pencil || eye || trash;
    const btn = makeInlineClone(base);
    btn.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); handleEdit(tile); });
    (pencil?pencil:trash?trash:row).insertAdjacentElement(pencil?"afterend":trash?"beforebegin":"beforeend", btn);
  }

  function injectLauncherNearHelp(){
    const helps = qa('button[aria-label*="Help"],[role="button"][aria-label*="help"]');
    const help = helps.find(b=>b.offsetParent!==null);
    const host = help?.parentElement;
    if(host && !host.querySelector(`[aria-label="${LAUNCHER_ARIA}"]`)){
      const btn = (help.cloneNode(true));
      btn.setAttribute("aria-label", LAUNCHER_ARIA);
      btn.title = "Open Editor (blank)";
      const svg = btn.querySelector("svg");
      const icon = cloneByAriaIncludes(["Edit","Open"]) || `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"/></svg>`;
      if(svg){ svg.replaceWith(document.createRange().createContextualFragment(icon)); }
      btn.addEventListener("click",(e)=>{ e.preventDefault(); e.stopPropagation(); openEditorWithBlob(null); });
      help.insertAdjacentElement("afterend", btn);
      return true;
    }
    return false;
  }

  const obs=new MutationObserver(muts=>{
    for(const m of muts){ for(const n of m.addedNodes){ if(!(n instanceof Element)) continue;
      if(n.querySelector?.('button[aria-label*="Remove"],button[aria-label*="Delete"],button[aria-label*="Preview"],button[aria-label*="Open"],button[aria-label*="View"],[aria-label*="Modify"],[aria-label="Edit"]')) enhanceTile(tileFromNode(n));
      n.querySelectorAll?.('img[src^="blob:"],img').forEach(img=> enhanceTile(tileFromNode(img)));
    } }
    injectLauncherNearHelp();
  });
  obs.observe(document.body,{childList:true,subtree:true});
  const sweep=()=>{
     qa('img[src^="blob:"]').forEach(i=>enhanceTile(tileFromNode(i)));
    qa('button[aria-label*="Remove"],button[aria-label*="Delete"],[aria-label*="Modify"],[aria-label="Edit"]').forEach(n=>enhanceTile(tileFromNode(n)));
    injectLauncherNearHelp();
  };
  sweep(); setTimeout(sweep,400); setTimeout(sweep,1200);

  // global paste opener (when editor isn't visible)
  document.addEventListener("paste",(e)=>{
    if(!CAPTURE_PASTE_ALWAYS) return;
    if(q('#eu-overlay')) return;
    const items = e.clipboardData?.items || [];
    for(const it of items){
      if(it.type && it.type.startsWith("image/")){
        e.preventDefault();
        const blob = it.getAsFile();
        openEditorWithBlob(blob);
        return;
      }
    }
  }, {capture:true});

  log("EditUploadsV1 loaded");
})();
