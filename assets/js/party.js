/* party.js — Modo Party: roleta de nomes pra sortear quem responde + placar.
   Pensado pra estudo em grupo (a Vitória e os amigos, num aparelho só).
   Exposto em window.Party. */
(function (global) {
  'use strict';

  var UI = global.UI;
  var CHAVE = 'party-vitoria';
  var CORES = ['#6D28D9', '#A21CAF', '#0D9488', '#D97706', '#4F46E5', '#DB2777', '#0891B2', '#7C3AED'];
  var girando = false;

  function ler() {
    try { var j = JSON.parse(global.localStorage.getItem(CHAVE) || '{}'); return Array.isArray(j.participantes) ? j : { participantes: [] }; }
    catch (_) { return { participantes: [] }; }
  }
  function gravar(dados) {
    try { global.localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (e) {}
  }

  var estado = ler();

  /* ---------- roleta (SVG) ---------- */
  function rad(g) { return (g * Math.PI) / 180; }

  function desenharRoleta(svg, nomes) {
    svg.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg';
    if (!nomes.length) return;
    var ang = 360 / nomes.length;
    nomes.forEach(function (nome, i) {
      var ini = i * ang - 90, fim = (i + 1) * ang - 90;
      var x1 = 100 + 98 * Math.cos(rad(ini)), y1 = 100 + 98 * Math.sin(rad(ini));
      var x2 = 100 + 98 * Math.cos(rad(fim)), y2 = 100 + 98 * Math.sin(rad(fim));
      var grande = ang > 180 ? 1 : 0;
      var path = document.createElementNS(NS, 'path');
      // uma fatia só (1 participante) vira um círculo inteiro
      path.setAttribute('d', nomes.length === 1
        ? 'M100,2 A98,98 0 1,1 99.9,2 Z'
        : 'M100,100 L' + x1 + ',' + y1 + ' A98,98 0 ' + grande + ',1 ' + x2 + ',' + y2 + ' Z');
      path.setAttribute('fill', CORES[i % CORES.length]);
      svg.appendChild(path);

      var meio = ini + ang / 2;
      var tx = 100 + 62 * Math.cos(rad(meio)), ty = 100 + 62 * Math.sin(rad(meio));
      var txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', tx); txt.setAttribute('y', ty);
      txt.setAttribute('fill', '#fff');
      txt.setAttribute('font-size', nomes.length > 8 ? '9' : '11');
      txt.setAttribute('font-weight', '600');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.setAttribute('transform', 'rotate(' + (meio + 90) + ' ' + tx + ' ' + ty + ')');
      txt.textContent = nome.length > 12 ? nome.slice(0, 11) + '…' : nome;
      svg.appendChild(txt);
    });
  }

  function girar(svg, aoTerminar) {
    var nomes = estado.participantes.map(function (p) { return p.nome; });
    if (girando || nomes.length < 2) {
      if (nomes.length < 2) UI.renderToast('Adicione pelo menos 2 nomes.', 'alerta');
      return;
    }
    girando = true;
    var i = Math.floor(Math.random() * nomes.length);
    var ang = 360 / nomes.length;
    var voltas = 5 + Math.floor(Math.random() * 3);
    var alvo = voltas * 360 - (i * ang + ang / 2);
    svg.style.transition = 'transform 4s cubic-bezier(.17,.67,.16,1)';
    svg.style.transform = 'rotate(' + alvo + 'deg)';
    setTimeout(function () {
      // normaliza pra não crescer infinito
      svg.style.transition = 'none';
      svg.style.transform = 'rotate(' + (alvo % 360) + 'deg)';
      girando = false;
      aoTerminar(nomes[i], i);
    }, 4100);
  }

  /* ---------- confete ---------- */
  function confete() {
    var area = UI.el('div', { class: 'confete' });
    for (var i = 0; i < 60; i++) {
      var p = UI.el('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = CORES[i % CORES.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      p.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      area.appendChild(p);
    }
    document.body.appendChild(area);
    setTimeout(function () { if (area.parentNode) area.parentNode.removeChild(area); }, 3200);
  }

  /* ---------- placar ---------- */
  function renderPlacar(lista) {
    lista.innerHTML = '';
    if (!estado.participantes.length) {
      lista.appendChild(UI.el('p', { class: 'card__meta', text: 'Adicione os nomes de quem está estudando junto.' }));
      return;
    }
    var ordenado = estado.participantes.slice().sort(function (a, b) { return b.pontos - a.pontos; });
    ordenado.forEach(function (p, pos) {
      var medalha = p.pontos > 0 && pos === 0 ? '🏆 ' : '';
      var menos = UI.el('button', { class: 'btn btn--secundario btn--pequeno', type: 'button', 'aria-label': 'Tirar ponto de ' + p.nome }, ['−']);
      var mais = UI.el('button', { class: 'btn btn--primario btn--pequeno', type: 'button', 'aria-label': 'Dar ponto a ' + p.nome }, ['+']);
      var rem = UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', title: 'Remover ' + p.nome }, ['×']);
      menos.addEventListener('click', function () { p.pontos = Math.max(0, p.pontos - 1); salvarERender(); });
      mais.addEventListener('click', function () { p.pontos += 1; salvarERender(); confete(); });
      rem.addEventListener('click', function () {
        estado.participantes = estado.participantes.filter(function (x) { return x !== p; });
        salvarERender(true);
      });
      lista.appendChild(UI.el('div', { class: 'party-jogador' }, [
        UI.el('span', { class: 'party-jogador__nome', text: medalha + p.nome }),
        UI.el('span', { class: 'party-jogador__pontos', text: String(p.pontos) }),
        UI.el('div', { class: 'party-jogador__acoes' }, [menos, mais, rem]),
      ]));
    });
  }

  var refs = {};
  function salvarERender(redesenhar) {
    gravar(estado);
    renderPlacar(refs.lista);
    if (redesenhar) desenharRoleta(refs.svg, estado.participantes.map(function (p) { return p.nome; }));
  }

  function init() {
    refs.svg = document.getElementById('roleta');
    refs.lista = document.getElementById('placar');
    refs.vez = document.getElementById('vez');
    var inp = document.getElementById('novo-jogador');

    function adicionar() {
      var nome = (inp.value || '').trim();
      if (!nome) return;
      if (estado.participantes.some(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); })) {
        UI.renderToast('Esse nome já está na lista.', 'alerta'); return;
      }
      estado.participantes.push({ nome: nome, pontos: 0 });
      inp.value = '';
      salvarERender(true);
    }
    document.getElementById('btn-add-jogador').addEventListener('click', adicionar);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') adicionar(); });

    document.getElementById('btn-girar').addEventListener('click', function () {
      girar(refs.svg, function (nome) {
        refs.vez.textContent = '🎤 Vez de ' + nome + '!';
        refs.vez.classList.add('vez--destaque');
        setTimeout(function () { refs.vez.classList.remove('vez--destaque'); }, 1200);
        confete();
      });
    });

    document.getElementById('btn-zerar').addEventListener('click', function () {
      UI.renderModal({ titulo: 'Zerar placar', texto: 'Zerar os pontos de todo mundo? Os nomes continuam.', confirmar: 'Zerar' })
        .then(function (ok) {
          if (!ok) return;
          estado.participantes.forEach(function (p) { p.pontos = 0; });
          salvarERender();
          UI.renderToast('Placar zerado.', 'sucesso');
        });
    });

    desenharRoleta(refs.svg, estado.participantes.map(function (p) { return p.nome; }));
    renderPlacar(refs.lista);
  }

  global.Party = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
