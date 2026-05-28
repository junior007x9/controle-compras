import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Produto } from '../types';

export const CarrinhoItem = ({ item, styles, color, onEditar, onRemover }: { item: Produto, styles: any, color: any, onEditar: (i: Produto) => void, onRemover: (id: string) => void }) => {
  const isSemPreco = parseFloat(item.preco?.replace(",", ".") || "0") === 0;
  // Verifica se a pessoa anexou alguma foto
  const temAnexo = !!item.fotoProdutoUri || !!item.fotoEtiquetaUri; 

  return (
    <View style={[
      styles.itemCard, 
      isSemPreco && { borderColor: color.warning, borderWidth: 2 },
      // 🔥 CORREÇÃO VISUAL: Força o layout a ficar em linha e separa o texto dos botões
      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: 12, paddingHorizontal: 16 } 
    ]}>
      
      {/* Lado Esquerdo: Textos do Produto */}
      <View style={[styles.itemInfo, { flex: 1, marginRight: 12 }]}>
        <Text style={[styles.itemNome, { marginBottom: 4, fontSize: 16, fontWeight: 'bold', color: color.text }]} numberOfLines={2}>
          {item.nome}
        </Text>
        
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
          <Text style={[styles.itemCategoria, { fontSize: 12, color: color.textSecondary }]}>{item.categoria}</Text>
          {temAnexo && <Ionicons name="images" size={14} color={color.tint} style={{ marginLeft: 6 }} />}
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[styles.itemPreco, { fontSize: 16, fontWeight: '800', color: color.tint }]}>
            R$ {parseFloat(item.preco?.replace(",", ".") || "0").toFixed(2)}
          </Text>
          <Text style={[styles.itemQtd, { fontSize: 14, color: color.textSecondary, marginLeft: 6 }]}>
            x {item.qtd}
          </Text>
        </View>
        
        {isSemPreco && <Text style={{ color: color.warning, fontSize: 11, fontWeight: "bold", marginTop: 6 }}>⚠️ Falta colocar o preço!</Text>}
      </View>

      {/* Lado Direito: Botões de Editar e Apagar */}
      <View style={[styles.itemActions, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <TouchableOpacity style={{ padding: 8, backgroundColor: color.background, borderRadius: 8 }} onPress={() => onEditar(item)}>
          <Ionicons name="pencil" size={20} color={color.info} />
        </TouchableOpacity>
        
        <TouchableOpacity style={{ padding: 8, backgroundColor: color.background, borderRadius: 8 }} onPress={() => onRemover(item.id)}>
          <Ionicons name="trash" size={20} color={color.danger} />
        </TouchableOpacity>
      </View>
      
    </View>
  );
};