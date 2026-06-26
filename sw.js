/*
 * Wise World - Service Worker
 * オフラインで完全に動くように、アプリ一式をキャッシュします。
 * 中身を更新したら CACHE の数字を上げてください（例 v1 -> v2）。
 */
var CACHE = "wiseworld3-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./i18n.js",
  "./questions.ja.js",
  "./questions.en.js",
  "./questions.es.js",
  "./questions.fr.js",
  "./questions.pt.js",
  "./questions.id.js",
  "./questions.ar.js",
  "./questions.zh.js",
  "./questions.ru.js",
  "./questions.hi.js",
  "./questions.bn.js",
  "./questions.sw.js",
  "./audio.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
  "./icons/favicon-16.png"
];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// cache-first: オフライン最優先。あればキャッシュ、なければ取得してキャッシュ。
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit) return hit;
      return fetch(e.request).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        return res;
      }).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
