/* tema.js — modo claro/escuro. Carregado no <head> (antes da pintura) pra não piscar.
   Sem preferência salva, segue o sistema operacional. Exposto em window.Tema. */
(function (global) {
  'use strict';
  var CHAVE = 'tema-vitoria';

  function salvo() {
    try { return global.localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function aplicar(t) {
    var raiz = document.documentElement;
    if (t === 'escuro' || t === 'claro') raiz.setAttribute('data-tema', t);
    else raiz.removeAttribute('data-tema'); // volta a seguir o sistema
  }
  function atual() {
    var s = salvo();
    if (s) return s;
    return (global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches) ? 'escuro' : 'claro';
  }
  function definir(t) {
    try { global.localStorage.setItem(CHAVE, t); } catch (e) {}
    aplicar(t);
    atualizarBotao();
  }
  function alternar() { definir(atual() === 'escuro' ? 'claro' : 'escuro'); }

  function atualizarBotao() {
    var b = document.getElementById('btn-tema');
    if (!b) return;
    var escuro = atual() === 'escuro';
    b.textContent = escuro ? '☀️' : '🌙';
    b.setAttribute('title', escuro ? 'Voltar ao modo claro' : 'Modo noturno');
    b.setAttribute('aria-label', escuro ? 'Voltar ao modo claro' : 'Ativar modo noturno');
  }

  // aplica imediatamente (o script está no <head>)
  aplicar(salvo());

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('btn-tema');
    if (b) b.addEventListener('click', alternar);
    atualizarBotao();
  });

  global.Tema = { atual: atual, definir: definir, alternar: alternar };
})(window);
