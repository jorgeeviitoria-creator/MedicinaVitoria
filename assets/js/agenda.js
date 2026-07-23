/* agenda.js — cronograma de provas com contagem regressiva.
   Guarda no navegador (localStorage). Exposto em window.Agenda. */
(function (global) {
  'use strict';

  var UI = global.UI, Manifesto = global.Manifesto;
  var CHAVE = 'agenda-vitoria';

  function ler() {
    try { var j = JSON.parse(global.localStorage.getItem(CHAVE) || '[]'); return Array.isArray(j) ? j : []; }
    catch (_) { return []; }
  }
  function gravar(lista) {
    try { global.localStorage.setItem(CHAVE, JSON.stringify(lista)); }
    catch (e) { UI.renderToast('Não foi possível salvar no navegador.', 'erro', 6000); }
  }

  /** dias entre hoje (00:00) e a data (00:00). Negativo = passou. */
  function diasAte(iso) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var partes = String(iso).split('-');
    var alvo = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
    alvo.setHours(0, 0, 0, 0);
    return Math.round((alvo - hoje) / 86400000);
  }

  function textoContagem(d) {
    if (d === 0) return { txt: 'É HOJE!', status: 'erro' };
    if (d === 1) return { txt: 'É amanhã', status: 'erro' };
    if (d < 0) return { txt: 'há ' + Math.abs(d) + (Math.abs(d) === 1 ? ' dia' : ' dias'), status: 'neutro' };
    if (d <= 7) return { txt: 'faltam ' + d + ' dias', status: 'alerta' };
    return { txt: 'faltam ' + d + ' dias', status: 'sucesso' };
  }

  function fmtData(iso) {
    var p = String(iso).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function render() {
    var alvo = document.getElementById('lista-agenda');
    var lista = ler().slice().sort(function (a, b) { return a.data.localeCompare(b.data); });
    alvo.innerHTML = '';
    if (!lista.length) {
      alvo.appendChild(UI.renderVazio('📅', 'Nenhuma prova marcada',
        'Cadastre as datas das provas pra ver a contagem regressiva.'));
      return;
    }
    var futuras = lista.filter(function (p) { return diasAte(p.data) >= 0; });
    var passadas = lista.filter(function (p) { return diasAte(p.data) < 0; });

    function linha(p) {
      var d = diasAte(p.data);
      var c = textoContagem(d);
      var b = UI.renderBadge(c.status);
      var rem = UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', title: 'Remover' }, ['×']);
      rem.addEventListener('click', function () {
        UI.renderModal({ titulo: 'Remover data', texto: 'Remover "' + p.titulo + '" de ' + Manifesto.labelMateria(p.semestre, p.materia) + '?', confirmar: 'Remover', perigo: true })
          .then(function (ok) {
            if (!ok) return;
            gravar(ler().filter(function (x) { return x.id !== p.id; }));
            render();
            UI.renderToast('Data removida.', 'sucesso');
          });
      });
      return UI.el('div', { class: 'agenda-item' + (d < 0 ? ' agenda-item--passada' : '') }, [
        UI.el('div', { class: 'agenda-item__info' }, [
          UI.el('strong', { text: Manifesto.labelMateria(p.semestre, p.materia) + ' · ' + p.titulo }),
          UI.el('span', { class: 'card__meta', text: fmtData(p.data) }),
        ]),
        UI.el('span', { class: 'badge badge--' + c.status }, [
          UI.el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }), c.txt,
        ]),
        rem,
      ]);
    }

    if (futuras.length) {
      alvo.appendChild(UI.el('div', { class: 'grupo-tipo__titulo', text: 'Próximas' }));
      futuras.forEach(function (p) { alvo.appendChild(linha(p)); });
    }
    if (passadas.length) {
      alvo.appendChild(UI.el('div', { class: 'grupo-tipo__titulo', style: 'margin-top:24px;', text: 'Já passaram' }));
      passadas.forEach(function (p) { alvo.appendChild(linha(p)); });
    }
  }

  function init() {
    var selMat = document.getElementById('agenda-materia');
    var inpTitulo = document.getElementById('agenda-titulo');
    var inpData = document.getElementById('agenda-data');

    Promise.all([
      Manifesto.carregarManifesto().catch(function () { return null; }),
      Manifesto.carregarConfig().catch(function () { return null; }),
    ]).then(function () {
      var sems = Manifesto.listarSemestres();
      selMat.innerHTML = '';
      sems.forEach(function (s) {
        Manifesto.listarMaterias(s.slug).forEach(function (m) {
          selMat.appendChild(UI.el('option', { value: s.slug + '|' + m.slug }, [m.label]));
        });
      });
      render();
    });

    document.getElementById('btn-add-prova').addEventListener('click', function () {
      var v = selMat.value, titulo = (inpTitulo.value || '').trim(), data = inpData.value;
      if (!v) { UI.renderToast('Escolha a matéria.', 'erro'); return; }
      if (!titulo) { UI.renderToast('Dê um nome (ex.: P2).', 'erro'); return; }
      if (!data) { UI.renderToast('Escolha a data.', 'erro'); return; }
      var partes = v.split('|');
      var lista = ler();
      lista.push({ id: 'a' + Date.now().toString(36), semestre: partes[0], materia: partes[1], titulo: titulo, data: data });
      gravar(lista);
      inpTitulo.value = ''; inpData.value = '';
      render();
      UI.renderToast('Data marcada.', 'sucesso');
    });
  }

  global.Agenda = { init: init, diasAte: diasAte, textoContagem: textoContagem };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
