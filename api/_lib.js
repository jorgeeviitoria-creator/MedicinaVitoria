// _lib.js — utilidades compartilhadas das funções de anexos (Google Drive).
// Credenciais e senha vêm SÓ de variáveis de ambiente (nunca no código/repo).
const { google } = require('googleapis');
const crypto = require('crypto');

function driveClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.ID_DO_CLIENTE_DO_GOOGLE,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return { drive: google.drive({ version: 'v3', auth }), auth };
}

function pastaRaiz() { return process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.ID_DA_PASTA_DO_GOOGLE_DRIVE; }

function autorizado(req) {
  const esperada = String(process.env.UPLOAD_PASSWORD || process.env.SENHA_DE_UPLOAD || '').trim();
  if (!esperada) return false;
  const enviada = String(req.headers['x-portal-senha'] || '').trim();
  const a = Buffer.from(enviada);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch (_) { return false; }
}

// Sanitiza valores usados em appProperties / nomes (evita quebra de query e chaves inválidas).
function limpar(parte, max) {
  return String(parte == null ? '' : parte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max || 80) || 'sem-nome';
}

async function corpoJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// Link de visualização/stream adequado ao tipo (vídeo => player embutido do Drive).
function linkVisualizacao(id, mimeType) {
  return 'https://drive.google.com/file/d/' + id + '/preview';
}

module.exports = { driveClient, pastaRaiz, autorizado, limpar, corpoJson, linkVisualizacao };
