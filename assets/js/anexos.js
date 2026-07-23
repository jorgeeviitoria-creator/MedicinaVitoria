/* anexos.js — abas de Anotações/Trabalhos (upload/lista via Google Drive).
   Só funciona no site publicado (as funções /api rodam no Vercel). Exposto em window.Anexos. */
(function (global) {
  'use strict';

  var UI = global.UI;
  var CHAVE_SENHA = 'senha-portal-vitoria';

  function obterSenha(forcar) {
    var s = null;
    try { s = global.localStorage.getItem(CHAVE_SENHA); } catch (e) {}
    if (!s || forcar) {
      s = global.prompt('Senha do portal (para ver/enviar anexos):') || '';
      if (s) { try { global.localStorage.setItem(CHAVE_SENHA, s); } catch (e) {} }
    }
    return s;
  }
  function limparSenha() { try { global.localStorage.removeItem(CHAVE_SENHA); } catch (e) {} }

  function apiPost(path, body) {
    var senha = obterSenha(false);
    if (!senha) return Promise.reject(new Error('Senha necessária.'));
    return fetch('/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-portal-senha': senha },
      body: JSON.stringify(body),
    }).then(function (resp) {
      if (resp.status === 401) { limparSenha(); throw new Error('Senha incorreta — tente de novo.'); }
      return resp.json().catch(function () { return {}; }).then(function (j) {
        if (!resp.ok) throw new Error(j.erro || ('Erro ' + resp.status));
        return j;
      });
    });
  }

  // PUT do arquivo direto na sessão resumável do Drive (com progresso).
  function enviarBytes(sessionUrl, file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', sessionUrl);
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText || '{}')); } catch (_) { resolve({}); }
        } else reject(new Error('Falha no upload (' + xhr.status + ').'));
      };
      xhr.onerror = function () { reject(new Error('Erro de rede no upload.')); };
      xhr.send(file);
    });
  }

  function listar(sem, mat, tipo) {
    return apiPost('list', { semestre: sem, materia: mat, tipo: tipo }).then(function (j) { return j.itens || []; });
  }

  function upload(file, ctx, onProgress) {
    // Fluxo iniciado no navegador (CORS do Drive funciona quando o próprio browser
    // cria a sessão): pega token efêmero -> cria sessão -> PUT dos bytes -> finaliza.
    return apiPost('upload-token', {}).then(function (r) {
      var meta = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        parents: r.folderId ? [r.folderId] : undefined,
        appProperties: { portal: 'medicina-vitoria', semestre: ctx.sem, materia: ctx.mat, periodo: '', tipo: ctx.tipo },
      };
      return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + r.accessToken,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
        },
        body: JSON.stringify(meta),
      }).then(function (init) {
        var sessionUrl = init.headers.get('location') || init.headers.get('Location');
        if (!sessionUrl) throw new Error('Google não devolveu a URL de upload.');
        return enviarBytes(sessionUrl, file, onProgress);
      });
    }).then(function (put) {
      if (!put || !put.id) throw new Error('Drive não devolveu o id do arquivo.');
      return apiPost('finalize', { fileId: put.id });
    }).then(function (r) { return r.item; });
  }

  function excluir(fileId) { return apiPost('delete', { fileId: fileId }); }

  /* ---------- UI ---------- */
  function fmtTamanho(b) {
    if (b == null) return '';
    var u = ['B', 'KB', 'MB', 'GB', 'TB']; var i = 0; var n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (Math.round(n * 10) / 10) + ' ' + u[i];
  }
  function fmtData(iso) {
    if (!iso) return '';
    var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
  }
  function iconeMime(m) {
    m = m || '';
    if (m.indexOf('video') === 0) return '🎬';
    if (m.indexOf('image') === 0) return '🖼️';
    if (m.indexOf('pdf') !== -1) return '📄';
    if (m.indexOf('audio') === 0) return '🎧';
    return '📎';
  }

  function abrirPreview(item) {
    var fundo = UI.el('div', { class: 'anexo-modal' });
    var barra = UI.el('div', { class: 'anexo-modal__bar' }, [
      UI.el('button', { class: 'ver-bar__voltar', type: 'button', onclick: function () { fechar(); } },
        [UI.el('span', { class: 'seta', 'aria-hidden': 'true', text: '←' }), ' Fechar']),
      UI.el('span', { class: 'ver-bar__titulo', text: item.nome }),
    ]);
    var frame = UI.el('iframe', { class: 'anexo-modal__frame', src: item.preview, allow: 'autoplay', title: item.nome });
    function fechar() { if (fundo.parentNode) fundo.parentNode.removeChild(fundo); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('keydown', onKey);
    fundo.append(barra, frame);
    document.body.appendChild(fundo);
  }

  function renderPainel(painel, sem, mat, tipo, rotulo) {
    painel.innerHTML = '';
    var inputFile = UI.el('input', { type: 'file', hidden: 'hidden' });
    var btnEnviar = UI.el('button', { class: 'btn btn--primario', type: 'button' },
      ['Enviar ' + (tipo === 'anotacoes' ? 'anotação' : 'trabalho')]);
    var progresso = UI.el('div', { class: 'anexo-progress', hidden: 'hidden' }, [UI.el('div', { class: 'anexo-progress__bar' })]);
    var lista = UI.el('div', { class: 'anexo-lista' });
    var btnSenha = UI.el('button', { class: 'btn btn--secundario btn--pequeno', type: 'button', title: 'Trocar a senha guardada neste navegador' }, ['🔒 Trocar senha']);
    btnSenha.addEventListener('click', function () { limparSenha(); obterSenha(true); carregar(); });
    var toolbar = UI.el('div', { class: 'anexo-toolbar' }, [btnEnviar, inputFile, btnSenha, progresso]);
    painel.append(toolbar, lista);

    function carregar() {
      lista.innerHTML = '';
      lista.appendChild(UI.el('p', { class: 'card__meta', text: 'Carregando…' }));
      listar(sem, mat, tipo).then(function (itens) {
        lista.innerHTML = '';
        if (!itens.length) {
          lista.appendChild(UI.renderVazio('📂', tipo === 'anotacoes' ? 'Nenhuma anotação ainda' : 'Nenhum trabalho ainda',
            'Clique em <strong>Enviar</strong> pra anexar um arquivo (PDF, imagem, vídeo…).'));
          return;
        }
        itens.forEach(function (item) { lista.appendChild(cardAnexo(item, carregar)); });
      }).catch(function (e) {
        lista.innerHTML = '';
        var ehSenha = /senha/i.test(e.message || '');
        var box = UI.renderVazio(ehSenha ? '🔒' : '⚠️',
          ehSenha ? 'Senha incorreta' : 'Não deu pra carregar',
          UI.esc(e.message || ''));
        var btn = UI.el('button', { class: 'btn btn--primario', type: 'button', style: 'margin-top:12px;' },
          [ehSenha ? 'Digitar senha de novo' : 'Tentar de novo']);
        btn.addEventListener('click', function () {
          if (ehSenha) { limparSenha(); obterSenha(true); }
          carregar();
        });
        box.appendChild(btn);
        lista.appendChild(box);
      });
    }

    btnEnviar.addEventListener('click', function () { inputFile.click(); });
    inputFile.addEventListener('change', function () {
      var file = inputFile.files[0]; if (!file) return;
      btnEnviar.disabled = true;
      progresso.hidden = false;
      var bar = progresso.querySelector('.anexo-progress__bar');
      bar.style.width = '0%';
      upload(file, { sem: sem, mat: mat, tipo: tipo }, function (frac) { bar.style.width = Math.round(frac * 100) + '%'; })
        .then(function () { UI.renderToast('Enviado com sucesso.', 'sucesso'); })
        .catch(function (e) { UI.renderToast(e.message || 'Falha no envio.', 'erro', 6000); })
        .then(function () {
          btnEnviar.disabled = false; progresso.hidden = true; inputFile.value = ''; carregar();
        });
    });

    carregar();
  }

  function cardAnexo(item, recarregar) {
    var acoes = UI.el('div', { class: 'anexo-acoes' }, [
      UI.el('button', { class: 'btn btn--secundario btn--pequeno', type: 'button', onclick: function () { abrirPreview(item); } }, ['Abrir']),
      UI.el('button', { class: 'btn btn--perigo btn--pequeno', type: 'button', onclick: function () {
        UI.renderModal({ titulo: 'Excluir anexo', texto: 'Excluir “' + item.nome + '”? Isso apaga o arquivo do Drive.', confirmar: 'Excluir', perigo: true })
          .then(function (ok) {
            if (!ok) return;
            excluir(item.id).then(function () { UI.renderToast('Excluído.', 'sucesso'); recarregar(); })
              .catch(function (e) { UI.renderToast(e.message, 'erro', 6000); });
          });
      } }, ['Excluir']),
    ]);
    return UI.el('div', { class: 'anexo-card' }, [
      UI.el('div', { class: 'anexo-card__icone', 'aria-hidden': 'true', text: iconeMime(item.mimeType) }),
      UI.el('div', { class: 'anexo-card__info' }, [
        UI.el('strong', { text: item.nome }),
        UI.el('span', { class: 'card__meta', text: [fmtTamanho(item.tamanho), fmtData(item.dataModificacao)].filter(Boolean).join(' · ') }),
      ]),
      acoes,
    ]);
  }

  global.Anexos = { renderPainel: renderPainel, obterSenha: obterSenha, limparSenha: limparSenha };
})(window);
