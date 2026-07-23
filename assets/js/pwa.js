/* pwa.js — registra o service worker (só faz sentido servido por http/https;
   abrindo do disco em file:// o navegador não permite, e tudo bem). */
(function (global) {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  global.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('[pwa] service worker não registrado:', e && e.message);
    });
  });
})(window);
