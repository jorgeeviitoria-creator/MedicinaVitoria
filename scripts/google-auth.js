#!/usr/bin/env node
/**
 * google-auth.js — pega um REFRESH TOKEN do Google Drive (uso: uma vez só).
 * Sem dependências (só Node). RODE VOCÊ MESMO no seu terminal:
 *
 *   node scripts/google-auth.js
 *
 * Pré-requisitos (Google Cloud Console):
 *   1. Projeto criado, "Google Drive API" ativada.
 *   2. Tela de consentimento OAuth: External, PUBLICADA, escopo .../auth/drive.file
 *   3. Credencial OAuth do tipo "App para computador" (Desktop app) → copie Client ID e Secret.
 *
 * O script abre um servidor local, imprime uma URL pra você aprovar no navegador
 * (já logado na SUA conta Google) e imprime o refresh token. Cole-o no Vercel
 * como GOOGLE_REFRESH_TOKEN. NÃO cole o token no chat.
 */
const http = require('http');
const https = require('https');
const readline = require('readline');
const { URL } = require('url');

const PORT = 5555;
const REDIRECT = 'http://localhost:' + PORT + '/callback';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

function pergunta(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a.trim()); }));
}

function trocarCodigoPorToken(code, clientId, clientSecret) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
  }).toString();
  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://oauth2.googleapis.com/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (resp) => {
        let data = '';
        resp.on('data', (c) => { data += c; });
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n=== Refresh token do Google Drive ===\n');

  // 1) arquivo client_secret*.json passado como argumento; 2) env vars; 3) pergunta.
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const arquivo = process.argv[2];
  if (arquivo) {
    try {
      const j = JSON.parse(require('fs').readFileSync(arquivo, 'utf8'));
      const c = j.installed || j.web || j;
      clientId = c.client_id || clientId;
      clientSecret = c.client_secret || clientSecret;
      console.log('Lido de:', arquivo, '\n');
    } catch (e) {
      console.error('Não consegui ler o JSON:', e.message);
    }
  }
  if (!clientId) clientId = await pergunta('Cole o Client ID: ');
  if (!clientSecret) clientSecret = await pergunta('Cole o Client Secret: ');
  if (!clientId || !clientSecret) { console.error('Client ID/Secret vazios.'); process.exit(1); }

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  const server = http.createServer(async (req, res) => {
    if (req.url.indexOf('/callback') !== 0) { res.writeHead(404); res.end(); return; }
    const code = new URL(req.url, REDIRECT).searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Pode fechar esta aba e voltar ao terminal.</h2>');
    if (!code) { console.error('Sem code na resposta.'); process.exit(1); }
    try {
      const tok = await trocarCodigoPorToken(code, clientId, clientSecret);
      if (tok.refresh_token) {
        console.log('\n================= COPIE ISTO =================');
        console.log('GOOGLE_REFRESH_TOKEN=' + tok.refresh_token);
        console.log('=============================================');
        console.log('\nCole esse valor no Vercel (env var GOOGLE_REFRESH_TOKEN). NÃO cole no chat.\n');
      } else {
        console.error('\nNão veio refresh_token. Resposta:', JSON.stringify(tok, null, 2));
        console.error('Dica: revogue o acesso em myaccount.google.com/permissions e rode de novo (força prompt=consent).');
      }
    } catch (e) {
      console.error('Erro ao trocar o code:', e.message);
    } finally {
      server.close();
      process.exit(0);
    }
  });

  server.listen(PORT, () => {
    console.log('\nAbra esta URL no navegador (logado na SUA conta Google):\n');
    console.log(authUrl + '\n');
    console.log('Depois de aprovar, o token aparece aqui.\n');
  });
}

main();
