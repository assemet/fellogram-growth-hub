/**
 * Inline script that runs before the app. A phone that cached an old page can ask for app files that no longer exist,
 * which leaves a blank screen with no message. This guard:
 *  1. reloads the page once when an app file fails to load (the usual stale-cache case), and
 *  2. if nothing has appeared 8 seconds after load, shows a small message with a Reload button and the last error,
 *     so a blank screen can be reported with something to go on.
 * Plain ES5 on purpose: it must work in the oldest embedded browsers and must never throw.
 */
export const LOAD_GUARD_SCRIPT = `(function(){
try{
var errs=[];
function note(m){try{errs.push(String(m).slice(0,240))}catch(e){}}
var stale=/Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|Unexpected token '<'|Unexpected token </i;
function reloadOnce(why){
  try{
    if(sessionStorage.getItem('fg.reloaded'))return;
    sessionStorage.setItem('fg.reloaded','1');
    note('reload: '+why);
    location.reload();
  }catch(e){}
}
window.addEventListener('error',function(e){
  try{
    var t=e&&e.target;
    if(t&&t.tagName==='SCRIPT'){note('script failed: '+(t.src||''));reloadOnce('script');return}
    var m=(e&&e.message)||'error';
    note(m);
    if(stale.test(m))reloadOnce(m);
  }catch(x){}
},true);
window.addEventListener('unhandledrejection',function(e){
  try{
    var r=e&&e.reason;var m=(r&&(r.message||r))||'rejection';
    note(m);
    if(stale.test(String(m)))reloadOnce(String(m));
  }catch(x){}
});
setTimeout(function(){
  try{
    var b=document.body;
    if(b&&b.innerText&&b.innerText.replace(/\\s/g,'').length>0){try{sessionStorage.removeItem('fg.reloaded')}catch(e){}return}
    var ar=(document.documentElement.lang||'')==='ar';
    var d=document.createElement('div');
    d.setAttribute('style','position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:#f3f7ff;color:#0b1f5c;font-family:system-ui,sans-serif');
    var h=document.createElement('p');h.setAttribute('style','margin:0;font-size:18px;font-weight:700');
    h.textContent=ar?'تعذّر تحميل التطبيق':'The app could not load';
    var btn=document.createElement('button');btn.type='button';
    btn.setAttribute('style','border:0;border-radius:8px;padding:12px 24px;font-size:16px;font-weight:600;background:#0b5de5;color:#fff');
    btn.textContent=ar?'إعادة التحميل':'Reload';
    btn.onclick=function(){try{sessionStorage.removeItem('fg.reloaded')}catch(e){}location.reload()};
    var s=document.createElement('p');s.setAttribute('style','margin:0;max-width:320px;font-size:11px;opacity:.6;direction:ltr;word-break:break-word');
    s.textContent=errs.slice(-2).join(' | ')||'no error captured';
    d.appendChild(h);d.appendChild(btn);d.appendChild(s);
    (b||document.documentElement).appendChild(d);
  }catch(x){}
},8000);
}catch(e){}
})();`;
