// types/index.ts

export interface Produto {
  id: string;
  barras: string;
  nome: string;
  preco: string;
  qtd: string;
  categoria: string;
  fotoProdutoUri?: string | null;
  fotoEtiquetaUri?: string | null;
  linkProduto?: string | null;
  linkEtiqueta?: string | null;
}

export interface PrecoAnterior {
  preco_prateleira: number;
  mes_referencia: string;
  nome_produto: string;
  categoria: string;
  supermercado: string;
}