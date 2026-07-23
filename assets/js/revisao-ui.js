/* revisao-ui.js — interface da Revisão: filtros por semestre/matéria, baralho e estudo. */
(function (global) {
  'use strict';
  var UI = global.UI, Manifesto = global.Manifesto, Revisao = global.Revisao;
  function $(id) { return document.getElementById(id); }

  var filtro = { semestre: '', materia: '' };
  var fila = [], idx = 0, mostrando = false;

  function labelMat(sem, mat) {
    if (!mat) return 'Geral';
    try { return Manifesto.labelMateria(sem, mat); } catch (_) { return mat; }
  }

  /* ---------- filtros ---------- */
  function preencherFiltros() {
    var mapa = Revisao.materiasComCards();
    var selSem = $('rev-f-semestre'), selMat = $('rev-f-materia');
    selSem.innerHTML = '<option value="">Todos os semestres</option>';
    Object.keys(mapa).sort().forEach(function (sem) {
      selSem.appendChild(UI.el('option', { value: sem }, [Manifesto.labelSemestre(sem)]));
    });
    atualizarMaterias();
  }
  function atualizarMaterias() {
    var mapa = Revisao.materiasComCards();
    var selMat = $('rev-f-materia');
    selMat.innerHTML = '<option value="">Todas as matérias</option>';
    var sems = filtro.semestre ? [filtro.semestre] : Object.keys(mapa);
    sems.forEach(function (sem) {
      Object.keys(mapa[sem] || {}).sort().forEach(function (mat) {
        selMat.appendChild(UI.el('option', { value: sem + '|' + mat }, [labelMat(sem, mat) + (filtro.semestre ? '' : ' (' + Manifesto.labelSemestre(sem) + ')')]));
      });
    });
  }

  /* ---------- resumo + baralho ---------- */
  function atualizarResumo() {
    var e = Revisao.estatisticas(filtro);
    $('resumo-revisao').textContent = e.total + ' cards · ' + e.devidos + ' pra revisar hoje · ' + e.novos + ' novos';
    $('btn-estudar').disabled = e.devidos === 0;
    $('btn-estudar').textContent = e.devidos ? 'Estudar ' + e.devidos + ' card' + (e.devidos > 1 ? 's' : '') : 'Nada pra hoje 🎉';
  }

  function renderBaralho() {
    var alvo = $('lista-cards');
    var cards = Revisao.todos(filtro).map(Revisao.comProgresso);
    alvo.innerHTML = '';
    if (!cards.length) {
      alvo.appendChild(UI.renderVazio('🗂️', 'Sem cards aqui',
        'Rode <code>node scripts/extrair-cards.js</code> pra puxar as perguntas dos painéis, ou adicione cards acima.'));
      return;
    }
    cards.sort(function (a, b) { return (a.proximaRevisao || '').localeCompare(b.proximaRevisao || ''); });
    cards.slice(0, 300).forEach(function (c) {
      var quando = c.ultimaRevisao ? ('revisar em ' + c.proximaRevisao) : 'novo';
      var tag = c.origem === 'painel' ? '📘 painel' : '✏️ meu';
      var acoes = [];
      if (c.origem === 'usuario') {
        var rem = UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', title: 'Excluir' }, ['×']);
        rem.addEventListener('click', function () {
          UI.renderModal({ titulo: 'Excluir card', texto: 'Excluir este card seu?', confirmar: 'Excluir', perigo: true })
            .then(function (ok) { if (ok) { Revisao.excluir(c.id); renderBaralho(); atualizarResumo(); } });
        });
        acoes.push(rem);
      }
      alvo.appendChild(UI.el('div', { class: 'rev-card-item' }, [
        UI.el('div', { class: 'rev-card-item__info' }, [
          UI.el('strong', { text: c.frente }),
          UI.el('span', { class: 'card__meta', text: labelMat(c.semestre, c.materia) + ' · ' + tag + ' · ' + quando }),
        ]),
      ].concat(acoes)));
    });
    if (cards.length > 300) alvo.appendChild(UI.el('p', { class: 'card__meta', text: '… e mais ' + (cards.length - 300) + ' (mostrando 300).' }));
  }

  /* ---------- estudo ---------- */
  function abrirEstudo() {
    fila = Revisao.devidos(filtro);
    // embaralha pra não decorar a ordem
    for (var i = fila.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = fila[i]; fila[i] = fila[j]; fila[j] = t; }
    if (!fila.length) return;
    idx = 0; $('estudo').hidden = false; $('baralho').hidden = true; mostrarCard();
  }
  function fecharEstudo() { $('estudo').hidden = true; $('baralho').hidden = false; renderBaralho(); atualizarResumo(); }

  function mostrarCard() {
    if (idx >= fila.length) { fecharEstudo(); UI.renderToast('Revisão concluída! 🎉', 'sucesso'); return; }
    mostrando = false;
    var c = fila[idx];
    $('estudo-progresso').textContent = (idx + 1) + ' de ' + fila.length + ' · ' + labelMat(c.semestre, c.materia);
    $('flash-frente').textContent = c.frente;
    $('flash-verso').textContent = c.verso;
    $('flashcard').classList.remove('rev-flip');
    $('estudo-notas').hidden = true;
    $('btn-mostrar').hidden = false;
  }
  function mostrarResposta() { mostrando = true; $('flashcard').classList.add('rev-flip'); $('btn-mostrar').hidden = true; $('estudo-notas').hidden = false; }
  function nota(q) { if (!mostrando) return; Revisao.revisar(fila[idx].id, q); idx += 1; mostrarCard(); }

  function init() {
    var selMat = $('rev-materia'); // do formulário de novo card
    Promise.all([
      Manifesto.carregarManifesto().catch(function () { return null; }),
      Manifesto.carregarConfig().catch(function () { return null; }),
    ]).then(function () {
      selMat.innerHTML = '<option value="">Geral (sem matéria)</option>';
      Manifesto.listarSemestres().forEach(function (s) {
        Manifesto.listarMaterias(s.slug).forEach(function (m) {
          selMat.appendChild(UI.el('option', { value: s.slug + '|' + m.slug }, [m.label]));
        });
      });
      preencherFiltros();
      renderBaralho(); atualizarResumo();
    });

    $('rev-f-semestre').addEventListener('change', function () {
      filtro.semestre = this.value; filtro.materia = '';
      atualizarMaterias(); renderBaralho(); atualizarResumo();
    });
    $('rev-f-materia').addEventListener('change', function () {
      var v = this.value;
      if (v) { var p = v.split('|'); filtro.semestre = p[0]; filtro.materia = p[1]; }
      else { filtro.materia = ''; }
      renderBaralho(); atualizarResumo();
    });

    $('btn-add-card').addEventListener('click', function () {
      var frente = ($('rev-frente').value || '').trim(), verso = ($('rev-verso').value || '').trim();
      if (!frente || !verso) { UI.renderToast('Preencha pergunta e resposta.', 'erro'); return; }
      var v = selMat.value ? selMat.value.split('|') : ['', ''];
      try {
        Revisao.adicionar(v[1], v[0], frente, verso);
        $('rev-frente').value = ''; $('rev-verso').value = ''; $('rev-frente').focus();
        renderBaralho(); atualizarResumo();
        UI.renderToast('Card adicionado.', 'sucesso');
      } catch (e) { UI.renderToast(e.message, 'erro', 6000); }
    });

    $('btn-estudar').addEventListener('click', abrirEstudo);
    $('btn-fechar-estudo').addEventListener('click', fecharEstudo);
    $('btn-mostrar').addEventListener('click', mostrarResposta);
    $('flashcard').addEventListener('click', function () { if (!mostrando) mostrarResposta(); });
    $('nota-errei').addEventListener('click', function () { nota(1); });
    $('nota-dificil').addEventListener('click', function () { nota(3); });
    $('nota-bom').addEventListener('click', function () { nota(4); });
    $('nota-facil').addEventListener('click', function () { nota(5); });

    document.addEventListener('keydown', function (e) {
      if ($('estudo').hidden) return;
      if ((e.key === ' ' || e.key === 'Enter') && !mostrando) { e.preventDefault(); mostrarResposta(); }
      else if (mostrando && ['1', '2', '3', '4'].indexOf(e.key) !== -1) nota([1, 3, 4, 5][Number(e.key) - 1]);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
