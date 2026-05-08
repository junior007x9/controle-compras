// services/dbService.ts

import { turso } from "../database";
import { Produto, PrecoAnterior } from "../types";
import { uploadImagemParaNuvem } from "./apiService";

export const checarPrecoAnterior = async (codigo: string, familiaId: string): Promise<PrecoAnterior | null> => {
  try {
    const resultado = await turso.execute({
      // 🔥 AQUI ESTÁ A CORREÇÃO: "AND familia_id = ?" garante a privacidade dos preços
      sql: "SELECT preco_prateleira, mes_referencia, nome_produto, categoria, supermercado FROM compras_historico WHERE codigo_barras = ? AND familia_id = ? ORDER BY id DESC LIMIT 1",
      args: [codigo, familiaId],
    });
    if (resultado.rows.length > 0) return resultado.rows[0] as unknown as PrecoAnterior;
    return null;
  } catch (e) {
    console.error("Erro ao checar preço anterior no banco:", e);
    return null;
  }
};

export const processarCompra = async (itensCarrinho: Produto[], mercadoNome: string, familiaId: string | null) => {
  const dataAtual = new Date();
  const mesReferencia = `${String(dataAtual.getMonth() + 1).padStart(2, "0")}-${dataAtual.getFullYear()}`;

  try {
    await turso.execute("ALTER TABLE compras_historico ADD COLUMN familia_id TEXT");
  } catch (e) {
    // Ignora o erro se a coluna já existir
  }

  const carrinhoComLinks = await Promise.all(
    itensCarrinho.map(async (item) => {
      let linkProduto = item.fotoProdutoUri?.startsWith("http") ? item.fotoProdutoUri : null;
      let linkEtiqueta = item.fotoEtiquetaUri?.startsWith("http") ? item.fotoEtiquetaUri : null;
      
      if (!linkProduto && item.fotoProdutoUri) linkProduto = await uploadImagemParaNuvem(item.fotoProdutoUri);
      if (!linkEtiqueta && item.fotoEtiquetaUri) linkEtiqueta = await uploadImagemParaNuvem(item.fotoEtiquetaUri);
      
      return { ...item, linkProduto, linkEtiqueta };
    }),
  );

  for (const item of carrinhoComLinks) {
    const quantidade = Math.max(1, Math.round(parseFloat(item.qtd?.replace(",", ".") || "1")));
    for (let i = 0; i < quantidade; i++) {
      await turso.execute({
        sql: "INSERT INTO compras_historico (codigo_barras, nome_produto, preco_prateleira, mes_referencia, foto_comprovante, foto_etiqueta, categoria, supermercado, familia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          item.barras || "sem_codigo",
          item.nome,
          parseFloat(item.preco?.replace(",", ".") || "0"),
          mesReferencia,
          item.linkProduto,
          item.linkEtiqueta,
          item.categoria,
          mercadoNome,
          familiaId,
        ],
      });
    }
  }
};