/* componentes-ui.js — renderização reutilizável: cards, tabelas, toasts, modais.
   Exposto em window.UI. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    });
    (filhos || []).forEach(function (f) {
      if (f == null) return;
      e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return e;
  }

  /** badge de status com ícone + texto (nunca só cor). */
  function renderBadge(status) {
    // status: 'sucesso' | 'alerta' | 'erro' | 'neutro' | 'acento'
    var mapa = {
      sucesso: { icone: '✓', texto: 'Aprovando' },
      alerta: { icone: '▲', texto: 'Em risco' },
      erro: { icone: '✕', texto: 'Reprovado' },
      neutro: { icone: '•', texto: 'Sem notas ainda' },
    };
    return mapa[status] || mapa.neutro;
  }

  /**
   * renderCard de matéria.
   * @param {{semestre,slug,label,badgeStatus,badgeTexto,contagem,href}} m
   */
  function renderCard(m) {
    var b = renderBadge(m.badgeStatus);
    var badge = el('span', { class: 'badge badge--' + m.badgeStatus }, [
      el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: b.icone }),
      m.badgeTexto || b.texto,
    ]);
    return el('article', { class: 'card card-materia' }, [
      el('div', { class: 'card-materia__topo' }, [
        el('h3', { class: 'card__titulo', text: m.label }),
        badge,
      ]),
      el('p', { class: 'card__meta', text: m.contagem || 'Sem materiais ainda' }),
      el('div', { class: 'card-materia__rodape' }, [
        el('a', { class: 'btn btn--primario', href: m.href }, ['Abrir matéria']),
      ]),
    ]);
  }

  /** ícone por formato do arquivo. */
  function iconeFormato(formato) {
    switch (formato) {
      case 'pdf': return '📄';
      case 'png': case 'jpg': case 'gif': case 'webp': case 'svg': return '🖼️';
      case 'doc': case 'docx': return '📝';
      case 'ppt': case 'pptx': return '📊';
      case 'xls': case 'xlsx': return '📈';
      case 'html': return '→';
      default: return '📎';
    }
  }

  /** card de item (material) clicável; abre o arquivo (HTML/PDF renderizam no navegador). */
  function renderItemCard(item) {
    var fmt = item.formato || 'html';
    var meta = 'Modificado em ' + (item.dataModificacao || '—');
    if (fmt !== 'html') meta = fmt.toUpperCase() + ' · ' + meta;
    return el('a', {
      class: 'card', href: 'ver.html?item=' + encodeURIComponent(item.id),
      style: 'display:block;text-decoration:none;color:inherit;margin-bottom:12px;',
    }, [
      el('div', { style: 'display:flex;justify-content:space-between;gap:8px;align-items:center;' }, [
        el('strong', { text: item.titulo }),
        el('span', { class: 'badge badge--acento' }, [
          el('span', { class: 'badge__icone', 'aria-hidden': 'true', text: iconeFormato(fmt) }), item.tipo,
        ]),
      ]),
      el('span', { class: 'card__meta', style: 'margin:4px 0 0;display:block;', text: meta }),
    ]);
  }

  /**
   * renderTabela genérica.
   * @param {string[]} colunas cabeçalhos
   * @param {Array<Array<Node|string>>} linhas células por linha
   */
  function renderTabela(colunas, linhas) {
    var thead = el('thead', {}, [
      el('tr', {}, colunas.map(function (c) { return el('th', { text: c }); })),
    ]);
    var tbody = el('tbody', {}, linhas.map(function (row) {
      return el('tr', {}, row.map(function (cel) {
        return el('td', {}, [typeof cel === 'string' ? document.createTextNode(cel) : cel]);
      }));
    }));
    return el('div', { class: 'tabela-wrap' }, [el('table', { class: 'tabela' }, [thead, tbody])]);
  }

  /** toast temporário (3s). tipo: 'sucesso'|'erro'|'alerta'|undefined */
  function renderToast(msg, tipo, ms) {
    var area = document.querySelector('.toast-area');
    if (!area) {
      area = el('div', { class: 'toast-area', 'aria-live': 'polite', role: 'status' });
      document.body.appendChild(area);
    }
    var t = el('div', { class: 'toast' + (tipo ? ' toast--' + tipo : ''), text: msg });
    area.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
    }, ms || 3000);
  }

  /** modal de confirmação. Retorna Promise<boolean>. */
  function renderModal(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var fundo = el('div', { class: 'modal-fundo', role: 'dialog', 'aria-modal': 'true' });
      function fechar(v) { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); resolve(v); }
      var modal = el('div', { class: 'modal' }, [
        el('h2', { class: 'modal__titulo', text: opts.titulo || 'Confirmar' }),
        el('p', { class: 'modal__texto', text: opts.texto || 'Tem certeza?' }),
        el('div', { class: 'modal__acoes' }, [
          el('button', { class: 'btn btn--secundario', onclick: function () { fechar(false); } }, [opts.cancelar || 'Cancelar']),
          el('button', {
            class: 'btn ' + (opts.perigo ? 'btn--perigo' : 'btn--primario'),
            onclick: function () { fechar(true); },
          }, [opts.confirmar || 'Confirmar']),
        ]),
      ]);
      fundo.appendChild(modal);
      fundo.addEventListener('click', function (e) { if (e.target === fundo) fechar(false); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); fechar(false); }
      });
      document.body.appendChild(fundo);
      modal.querySelector('.btn--primario, .btn--perigo').focus();
    });
  }

  function renderVazio(icone, titulo, htmlDetalhe) {
    return el('div', { class: 'vazio' }, [
      el('div', { class: 'vazio__icone', 'aria-hidden': 'true', text: icone || '📭' }),
      el('h3', { text: titulo || 'Nada por aqui ainda' }),
      el('p', { html: htmlDetalhe || '' }),
    ]);
  }

  global.UI = {
    esc: esc, el: el,
    renderBadge: renderBadge,
    renderCard: renderCard,
    renderItemCard: renderItemCard,
    renderTabela: renderTabela,
    renderToast: renderToast,
    renderModal: renderModal,
    renderVazio: renderVazio,
  };
})(window);
