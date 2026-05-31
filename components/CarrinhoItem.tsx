import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Produto } from '../types';

export const CarrinhoItem = ({ item, styles, color, onEditar, onRemover }: { item: Produto, styles: any, color: any, onEditar: (i: Produto) => void, onRemover: (id: string) => void }) => {
  
  // 🔥 MÁGICA DA MATEMÁTICA: Pegamos o preço, a quantidade e multiplicamos
  const precoUnitario = parseFloat(item.preco?.replace(",", ".") || "0");
  const quantidade = parseFloat(item.qtd?.replace(",", ".") || "1");
  const valorTotalItem = precoUnitario * quantidade;

  const isSemPreco = precoUnitario === 0;
  const temAnexo = !!item.fotoProdutoUri || !!item.fotoEtiquetaUri; 

  return (
    <TouchableOpacity 
      activeOpacity={0.7}
      onPress={() => onEditar(item)}
      style={[
        meusEstilos.cardComprovante, 
        { backgroundColor: color.card, borderColor: isSemPreco ? color.warning : color.border },
        isSemPreco && { borderWidth: 2 }
      ]}
    >
      
      {/* Ícone Lateral */}
      <View style={[meusEstilos.iconeLateral, { backgroundColor: color.background }]}>
        <Ionicons name="cart-outline" size={24} color={color.textSecondary} />
      </View>

      {/* Textos Centrais */}
      <View style={meusEstilos.textosContainer}>
        <Text style={[meusEstilos.nome, { color: color.text }]} numberOfLines={2}>
          {item.nome}
        </Text>
        
        <View style={meusEstilos.infoRow}>
          {/* Mostramos a quantidade e o preço unitário em ponto pequeno para não perderes o rasto */}
          <Text style={[meusEstilos.categoria, { color: color.textSecondary }]}>
            {item.qtd}x (R$ {precoUnitario.toFixed(2)}) • {item.categoria}
          </Text>
          {temAnexo && <Ionicons name="images" size={14} color={color.tint} style={{ marginLeft: 6 }} />}
        </View>
        
        {isSemPreco && <Text style={{ color: color.warning, fontSize: 11, fontWeight: "bold", marginTop: 4 }}>⚠️ Falta colocar o preço!</Text>}
      </View>

      {/* Valor e Botão Apagar */}
      <View style={meusEstilos.valorEApagarContainer}>
        {/* AQUI MOSTRA O VALOR TOTAL DO ITEM (QTD * PREÇO) */}
        <Text style={[meusEstilos.valorTotal, { color: color.text }]}>
          R$ {valorTotalItem.toFixed(2)}
        </Text>
        
        <TouchableOpacity 
          style={meusEstilos.botaoApagar} 
          onPress={() => onRemover(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={color.danger} />
        </TouchableOpacity>
      </View>
      
    </TouchableOpacity>
  );
};

const meusEstilos = StyleSheet.create({
  cardComprovante: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  iconeLateral: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textosContainer: {
    flex: 1,
    marginRight: 8,
  },
  nome: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  categoria: {
    fontSize: 12,
    fontWeight: '600',
  },
  valorEApagarContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
  },
  valorTotal: {
    fontSize: 18,
    fontWeight: '900',
  },
  botaoApagar: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.05)', 
  }
});