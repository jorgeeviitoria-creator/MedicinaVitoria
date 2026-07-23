// POST /api/upload-token
// Retorna { accessToken, folderId } — token OAuth de curta duração (~1h, escopo drive.file)
// pra o NAVEGADOR iniciar a sessão de upload resumável direto no Google (CORS funciona assim).
const { driveClient, pastaRaiz, autorizado } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!autorizado(req)) return res.status(401).json({ erro: 'Senha inválida.' });
  try {
    const { auth } = driveClient();
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error('sem access token (refresh token inválido?)');
    return res.status(200).json({ accessToken: token, folderId: pastaRaiz() });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao obter token.', detalhe: String(e && e.message || e) });
  }
};
