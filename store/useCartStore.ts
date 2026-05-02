import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { turso } from "../database";
import { useAuthStore } from "./useAuthStore";

interface CartState {
  saldo: number;
  carrinho: any[];
  historico: any[];
  setSaldo: (valor: number) => void;
  setCarrinho: (itens: any[]) => void;
  adicionarItem: (item: any, editando: boolean) => Promise<void>;
  removerItem: (id: string) => Promise<void>;
  limparCarrinho: () => Promise<void>;
  getTotal: () => number;
  sincronizarComNuvem: () => Promise<void>;
  atualizarSaldoBanco: (novoSaldo: number) => Promise<void>;
  adicionarAoHistorico: (compra: any) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      saldo: 0,
      carrinho: [],
      historico: [],

      setSaldo: (valor) => set({ saldo: valor }),
      setCarrinho: (itens) => set({ carrinho: itens }),
      adicionarAoHistorico: (item) =>
        set((state) => ({
          historico: [item, ...state.historico].slice(0, 50),
        })),

      sincronizarComNuvem: async () => {
        const familiaId = useAuthStore.getState().familiaId;
        if (!familiaId) return;

        try {
          // 🔥 1. A CORREÇÃO: GARANTIR QUE AS TABELAS EXISTEM NA NUVEM!
          await turso.execute(
            "CREATE TABLE IF NOT EXISTS carteira_familias (familia_id TEXT PRIMARY KEY, saldo REAL)",
          );

          await turso.execute(
            "CREATE TABLE IF NOT EXISTS carrinho_familias (id TEXT PRIMARY KEY, barras TEXT, nome TEXT, preco TEXT, qtd TEXT, categoria TEXT, fotoProdutoUri TEXT, fotoEtiquetaUri TEXT, familia_id TEXT)",
          );

          await turso.execute(`
            CREATE TABLE IF NOT EXISTS compras_historico (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              codigo_barras TEXT,
              nome_produto TEXT,
              preco_prateleira REAL,
              mes_referencia TEXT,
              foto_comprovante TEXT,
              foto_etiqueta TEXT,
              categoria TEXT,
              supermercado TEXT,
              familia_id TEXT
            )
          `);
          // Segurança extra: se a tabela já existia mas faltava a família
          try {
            await turso.execute(
              "ALTER TABLE compras_historico ADD COLUMN familia_id TEXT",
            );
          } catch (e) {}

          // 2. Sincroniza Saldo
          const resSaldo = await turso.execute({
            sql: "SELECT saldo FROM carteira_familias WHERE familia_id = ?",
            args: [familiaId],
          });
          if (resSaldo.rows.length > 0)
            set({ saldo: Number(resSaldo.rows[0].saldo) });

          // 3. Sincroniza Carrinho
          const resCarrinho = await turso.execute({
            sql: "SELECT * FROM carrinho_familias WHERE familia_id = ?",
            args: [familiaId],
          });
          const carrinhoNuvem = resCarrinho.rows.map((r) => ({
            id: String(r.id),
            barras: String(r.barras || ""),
            nome: String(r.nome),
            preco: String(r.preco),
            qtd: String(r.qtd),
            categoria: String(r.categoria),
            fotoProdutoUri: r.fotoProdutoUri ? String(r.fotoProdutoUri) : null,
            fotoEtiquetaUri: r.fotoEtiquetaUri
              ? String(r.fotoEtiquetaUri)
              : null,
          }));
          set({ carrinho: carrinhoNuvem.reverse() });

          // 4. Sincroniza Histórico
          const resHist = await turso.execute({
            sql: "SELECT * FROM compras_historico WHERE familia_id = ? ORDER BY id DESC LIMIT 50",
            args: [familiaId],
          });
          set({ historico: resHist.rows });
        } catch (e) {
          console.error("Erro na nuvem, mantendo dados offline:", e);
        }
      },

      atualizarSaldoBanco: async (novoSaldo) => {
        const familiaId = useAuthStore.getState().familiaId;
        set({ saldo: novoSaldo });
        try {
          await turso.execute({
            sql: "INSERT OR REPLACE INTO carteira_familias (familia_id, saldo) VALUES (?, ?)",
            args: [familiaId, novoSaldo],
          });
        } catch (e) {}
      },

      adicionarItem: async (item, editando) => {
        const state = get();
        const familiaId = useAuthStore.getState().familiaId;
        if (editando) {
          set({
            carrinho: state.carrinho.map((i) => (i.id === item.id ? item : i)),
          });
          try {
            await turso.execute({
              sql: "UPDATE carrinho_familias SET barras=?, nome=?, preco=?, qtd=?, categoria=?, fotoProdutoUri=?, fotoEtiquetaUri=? WHERE id=? AND familia_id=?",
              args: [
                item.barras || "",
                item.nome,
                item.preco,
                item.qtd,
                item.categoria,
                item.fotoProdutoUri || null,
                item.fotoEtiquetaUri || null,
                item.id,
                familiaId,
              ],
            });
          } catch (e) {}
        } else {
          set({ carrinho: [item, ...state.carrinho] });
          try {
            await turso.execute({
              sql: "INSERT INTO carrinho_familias (id, barras, nome, preco, qtd, categoria, fotoProdutoUri, fotoEtiquetaUri, familia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              args: [
                item.id,
                item.barras || "",
                item.nome,
                item.preco,
                item.qtd,
                item.categoria,
                item.fotoProdutoUri || null,
                item.fotoEtiquetaUri || null,
                familiaId,
              ],
            });
          } catch (e) {}
        }
      },

      removerItem: async (id) => {
        const familiaId = useAuthStore.getState().familiaId;
        set((state) => ({
          carrinho: state.carrinho.filter((i) => i.id !== id),
        }));
        try {
          await turso.execute({
            sql: "DELETE FROM carrinho_familias WHERE id = ? AND familia_id = ?",
            args: [id, familiaId],
          });
        } catch (e) {}
      },

      limparCarrinho: async () => {
        const familiaId = useAuthStore.getState().familiaId;
        set({ carrinho: [] });
        try {
          await turso.execute({
            sql: "DELETE FROM carrinho_familias WHERE familia_id = ?",
            args: [familiaId],
          });
        } catch (e) {}
      },

      getTotal: () =>
        get().carrinho.reduce((acc, item) => {
          const preco = parseFloat(item.preco?.replace(",", ".") || "0");
          const qtd = parseFloat(item.qtd?.replace(",", ".") || "1");
          return acc + preco * qtd;
        }, 0),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
