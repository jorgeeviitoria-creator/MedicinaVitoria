/* revisao-ui.js — interface da página de Revisão (baralho + sessão de estudo). */
(function (global) {
  'use strict';
  var UI = global.UI, Manifesto = global.Manifesto, Revisao = global.Revisao;

  function $(id) { return document.getElementById(id); }

  var fila = [];      // cards da sessão atual
  var idx = 0;
  var mostrando = false;

  function atualizarResumo() {
    var e = Revisao.estatisticas();
    $('resumo-revisao').textContent = e.total + ' cards · ' + e.devidos + ' pra revisar hoje · ' + e.novos + ' novos';
    $('btn-estudar').disabled = e.devidos === 0;
    $('btn-estudar').textContent = e.devidos ? 'Estudar ' + e.devidos + ' card' + (e.devidos > 1 ? 's' : '') : 'Nada pra hoje 🎉';
  }

  /* ---------- baralho ---------- */
  function renderBaralho() {
    var alvo = $('lista-cards');
    var cards = Revisao.listar();
    alvo.innerHTML = '';
    if (!cards.length) {
      alvo.appendChild(UI.renderVazio('🗂️', 'Baralho vazio', 'Adicione cards acima pra começar a revisar.'));
      return;
    }
    cards.slice().sort(function (a, b) { return (a.proximaRevisao || '').localeCompare(b.proximaRevisao || ''); })
      .forEach(function (c) {
        var mat = c.materia ? Manifesto.labelMateria(c.semestre, c.materia) : 'Geral';
        var quando = c.ultimaRevisao ? ('revisar em ' + c.proximaRevisao) : 'novo';
        var rem = UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', title: 'Excluir card' }, ['×']);
        rem.addEventListener('click', function () {
          UI.renderModal({ titulo: 'Excluir card', texto: 'Excluir este card do baralho?', confirmar: 'Excluir', perigo: true })
            .then(function (ok) { if (!ok) return; Revisao.excluir(c.id); renderBaralho(); atualizarResumo(); });
        });
        alvo.appendChild(UI.el('div', { class: 'rev-card-item' }, [
          UI.el('div', { class: 'rev-card-item__info' }, [
            UI.el('strong', { text: c.frente }),
            UI.el('span', { class: 'card__meta', text: mat + ' · ' + quando }),
          ]),
          rem,
        ]));
      });
  }

  /* ---------- sessão de estudo ---------- */
  function abrirEstudo() {
    fila = Revisao.devidos();
    if (!fila.length) return;
    idx = 0;
    $('estudo').hidden = false;
    $('baralho').hidden = true;
    mostrarCard();
  }
  function fecharEstudo() {
    $('estudo').hidden = true;
    $('baralho').hidden = false;
    renderBaralho(); atualizarResumo();
  }

  function mostrarCard() {
    if (idx >= fila.length) { fecharEstudo(); UI.renderToast('Revisão concluída! 🎉', 'sucesso'); return; }
    mostrando = false;
    var c = fila[idx];
    $('estudo-progresso').textContent = (idx + 1) + ' de ' + fila.length;
    $('flash-frente').textContent = c.frente;
    $('flash-verso').textContent = c.verso;
    $('flashcard').classList.remove('rev-flip');
    $('estudo-notas').hidden = true;
    $('btn-mostrar').hidden = false;
  }

  function mostrarResposta() {
    mostrando = true;
    $('flashcard').classList.add('rev-flip');
    $('btn-mostrar').hidden = true;
    $('estudo-notas').hidden = false;
  }

  function nota(q) {
    if (!mostrando) return;
    Revisao.revisar(fila[idx].id, q);
    idx += 1;
    mostrarCard();
  }

  function init() {
    var selMat = $('rev-materia');
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
      renderBaralho(); atualizarResumo();
    });

    $('btn-add-card').addEventListener('click', function () {
      var frente = ($('rev-frente').value || '').trim();
      var verso = ($('rev-verso').value || '').trim();
      if (!frente || !verso) { UI.renderToast('Preencha a pergunta e a resposta.', 'erro'); return; }
      var v = selMat.value ? selMat.value.split('|') : ['', ''];
      try {
        Revisao.adicionar(v[1], v[0], frente, verso);
        $('rev-frente').value = ''; $('rev-verso').value = '';
        $('rev-frente').focus();
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
      if (e.key === ' ' || e.key === 'Enter') { if (!mostrando) { e.preventDefault(); mostrarResposta(); } }
      else if (mostrando && ['1', '2', '3', '4'].indexOf(e.key) !== -1) {
        nota([1, 3, 4, 5][Number(e.key) - 1]);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
