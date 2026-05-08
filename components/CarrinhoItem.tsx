// components/CarrinhoItem.tsx

import React, { memo } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Produto } from "../types";

interface CarrinhoItemProps {
  item: Produto;
  styles: any;
  color: any;
  onEditar: (item: Produto) => void;
  onRemover: (id: string) => void;
}

export const CarrinhoItem = memo(({ item, styles, color, onEditar, onRemover }: CarrinhoItemProps) => {
  const precoNum = parseFloat(item.preco?.replace(",", ".") || "0");
  const qtdNum = parseFloat(item.qtd?.replace(",", ".") || "1");
  const subtotalItem = (precoNum * qtdNum).toFixed(2);
  const sufixo = String(item.qtd).includes(".") || String(item.qtd).includes(",") ? "kg" : "x";

  return (
    <TouchableOpacity
      style={[styles.itemCarrinho, precoNum === 0 && styles.itemCarrinhoAlerta]}
      onPress={() => onEditar(item)}
    >
      <View style={styles.itemInfo}>
        {item.fotoProdutoUri ? (
          <Image source={{ uri: item.fotoProdutoUri }} style={styles.miniature} />
        ) : (
          <View style={styles.miniaturePlaceholder}>
            <Ionicons name="basket-outline" size={20} color={color.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.itemNome}>
            {item.qtd}{sufixo} {item.nome}
          </Text>
          <Text style={styles.itemPrecoUnid}>
            {item.categoria}{" "}
            {precoNum === 0
              ? "⚠️ Faltando preço!"
              : `• R$ ${precoNum.toFixed(2)} ${sufixo === "kg" ? "o kg" : "un."}`}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.itemSubtotal}>R$ {subtotalItem}</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onRemover(item.id);
          }}
          style={{ marginTop: 5 }}
        >
          <Text style={{ color: color.warning, fontSize: 12, fontWeight: "bold" }}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});