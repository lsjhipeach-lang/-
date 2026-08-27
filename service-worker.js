const CACHE_NAME='sapporo-shell-v13-expense-insights';
const APP_SHELL=['./','./index.html','./manual.html','./sapporo-trip-user-manual.pdf','./style.css?v=11','./pwa.css?v=9','./script.js?v=13','./manifest.webmanifest','./offline.html','./icons/app-icon.svg','./icons/app-icon-192.png','./icons/app-icon-512.png','./icons/apple-touch-icon.png'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/rest/v1/')||url.pathname.includes('/auth/v1/')||url.pathname.includes('/realtime/v1/'))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html').then(response=>response||caches.match('./offline.html'))));
    return;
  }
  const isAppCode=['style','script'].includes(event.request.destination);
  if(isAppCode){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  })));
});
