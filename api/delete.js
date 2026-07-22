// POST /api/delete
// Body: { fileId }  — exclui um anexo do Drive (só arquivos criados pelo app são acessíveis via drive.file).
const { driveClient, autorizado, corpoJson } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido.' });
  if (!autorizado(req)) return res.status(401).json({ erro: 'Senha inválida.' });

  const b = await corpoJson(req);
  const fileId = b && b.fileId;
  if (!fileId || typeof fileId !== 'string') return res.status(400).json({ erro: 'fileId inválido.' });

  try {
    const { drive } = driveClient();
    await drive.files.delete({ fileId });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: 'Falha ao excluir.', detalhe: String(e && e.message || e) });
  }
};
