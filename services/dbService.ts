import { turso } from "../database";
import { Produto } from "../types";

export const checarPrecoAnterior = async (barras: string, familiaId: string) => {
  if (!barras || !familiaId) return null;
  try {
    const res = await turso.execute({
      sql: "SELECT preco_prateleira, supermercado, data_compra, nome_produto, categoria FROM compras_historico WHERE codigo_barras = ? AND familia_id = ? ORDER BY data_compra DESC LIMIT 1",
      args: [barras, familiaId]
    });
    if (res.rows.length > 0) {
      const dataFormatada = new Date(String(res.rows[0].data_compra)).toLocaleDateString('pt-BR');
      return { 
        preco: String(res.rows[0].preco_prateleira), 
        mercado: String(res.rows[0].supermercado), 
        data: dataFormatada,
        nome_produto: String(res.rows[0].nome_produto),
        categoria: String(res.rows[0].categoria)
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

export const processarCompra = async (carrinho: Produto[], supermercado: string, familiaId: string | null) => {
  if (!familiaId) throw new Error("Usuário não pertence a uma família.");

  const dataAtual = new Date();
  const dataIso = dataAtual.toISOString();
  const mesReferencia = `${String(dataAtual.getMonth() + 1).padStart(2, '0')}-${dataAtual.getFullYear()}`;

  // Criar tabela se não existir (garante compatibilidade retroativa)
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS compras_historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      familia_id TEXT,
      codigo_barras TEXT,
      nome_produto TEXT,
      supermercado TEXT,
      preco_prateleira REAL,
      preco_caixa REAL,
      data_compra TEXT,
      mes_referencia TEXT,
      categoria TEXT
    )
  `);

  const sql = `
    INSERT INTO compras_historico 
    (familia_id, codigo_barras, nome_produto, supermercado, preco_prateleira, preco_caixa, data_compra, mes_referencia, categoria) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const item of carrinho) {
    const precoFloat = parseFloat(item.preco.replace(',', '.') || "0");
    const qtdFloat = parseFloat(item.qtd.replace(',', '.') || "1");

    for (let i = 0; i < qtdFloat; i++) {
      await turso.execute({
        sql,
        args: [
          familiaId,
          item.barras || "",
          item.nome,
          supermercado,
          precoFloat,
          precoFloat, // Preço da caixa igual ao da prateleira na v1
          dataIso,
          mesReferencia,
          item.categoria || "Outros"
        ]
      });
    }
  }
};