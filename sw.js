/* sw.js — service worker do portal.
   Regras conservadoras pra nunca servir conteúdo velho de forma confusa:
   - /api/ NUNCA entra em cache (uploads/anexos dependem de resposta fresca).
   - navegação (páginas): rede primeiro, cache só como reserva offline.
   - estáticos: responde do cache e atualiza em segundo plano.
   Troque VERSAO para invalidar tudo. */
const VERSAO = 'v3';
const CACHE = 'portal-vitoria-' + VERSAO;

const ESSENCIAIS = [
  './', './index.html', './agenda.html', './calculadora.html', './historico.html',
  './materia.html', './party.html', './revisao.html', './ver.html',
  './assets/css/variaveis.css', './assets/css/componentes.css', './assets/css/layout.css',
  './assets/js/tema.js', './assets/js/pwa.js', './assets/js/componentes-ui.js',
  './assets/js/manifesto.js', './assets/js/notas.js', './assets/js/calculadora.js',
  './assets/js/app.js', './assets/js/anexos.js', './assets/js/party.js', './assets/js/agenda.js',
  './assets/js/revisao.js', './assets/js/revisao-ui.js',
  './data/conteudo.js', './data/cards.js', './manifest.webmanifest', './icone-192.png', './icone-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // um arquivo faltando não pode derrubar a instalação inteira
      Promise.all(ESSENCIAIS.map((u) => c.add(u).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // fontes/Drive: deixa passar
  if (url.pathname.indexOf('/api/') !== -1) return;  // nunca cachear a API

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cacheado) => {
      const rede = fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    })
  );
});
