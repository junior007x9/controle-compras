import React from 'react';
import { Modal, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CATEGORIAS } from '../../constants/Categories';
import { Produto, PrecoAnterior } from '../../types';

interface ProdutoModalProps {
  visivel: boolean;
  fecharModal: () => void;
  editando: boolean;
  produtoAtual: Produto;
  setProdutoAtual: (produto: Produto) => void;
  precoAnterior: PrecoAnterior | null;
  fotoProduto: { uri: string } | null;
  setFotoProduto: (foto: { uri: string } | null) => void;
  fotoEtiqueta: { uri: string } | null;
  setFotoEtiqueta: (foto: { uri: string } | null) => void;
  setFotoAmpliada: (uri: string) => void;
  setModoTirarFoto: (modo: "produto" | "etiqueta") => void;
  salvarNoCarrinho: () => void;
  color: any;
  styles: any;
}

export const ProdutoModal = ({
  visivel, fecharModal, editando, produtoAtual, setProdutoAtual, precoAnterior,
  fotoProduto, setFotoProduto, fotoEtiqueta, setFotoEtiqueta, setFotoAmpliada,
  setModoTirarFoto, salvarNoCarrinho, color, styles
}: ProdutoModalProps) => {
  return (
    <Modal visible={visivel} animationType="slide" transparent={true} onRequestClose={fecharModal}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={styles.dragPill} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{editando ? "Editar Produto" : "Detalhes do Produto"}</Text>
            <TouchableOpacity onPress={fecharModal} style={styles.btnClose}>
              <Ionicons name="close" size={24} color={color.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm} contentContainerStyle={{ paddingBottom: 250 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {precoAnterior && (
              <View style={styles.alertaInflacao}>
                <Ionicons name="analytics" size={24} color="#1E1E1E" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.textoInflacao}>
                    Última compra: <Text style={{ fontWeight: "bold" }}>R$ {Number(precoAnterior.preco_prateleira).toFixed(2)}</Text> no {precoAnterior.supermercado || "mercado"}
                  </Text>

                  {produtoAtual.preco && parseFloat(produtoAtual.preco) > 0 ? (() => {
                    const precoAtualNum = parseFloat(produtoAtual.preco.replace(",", "."));
                    const precoAntigoNum = Number(precoAnterior.preco_prateleira);
                    if (precoAtualNum > precoAntigoNum) {
                      const dif = ((precoAtualNum - precoAntigoNum) / precoAntigoNum) * 100;
                      return <Text style={{ color: "#EF4444", fontWeight: "bold", fontSize: 13, marginTop: 2 }}>📈 Subiu {dif.toFixed(1)}%</Text>;
                    } else if (precoAtualNum < precoAntigoNum) {
                      const dif = ((precoAntigoNum - precoAtualNum) / precoAntigoNum) * 100;
                      return <Text style={{ color: "#2ED1B2", fontWeight: "bold", fontSize: 13, marginTop: 2 }}>📉 Caiu {dif.toFixed(1)}%</Text>;
                    }
                    return <Text style={{ color: "#1E1E1E", fontWeight: "bold", fontSize: 13, marginTop: 2 }}>➖ Preço Manteve</Text>;
                  })() : null}
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.labelField}>CÓDIGO DE BARRAS</Text>
              <TextInput style={styles.inputModal} placeholderTextColor={color.textSecondary} placeholder="00000000" value={produtoAtual.barras} onChangeText={(t) => setProdutoAtual({ ...produtoAtual, barras: t })} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.labelField}>NOME DO PRODUTO</Text>
              <TextInput style={styles.inputModal} placeholderTextColor={color.textSecondary} placeholder="Ex: Arroz 1kg" value={produtoAtual.nome} onChangeText={(t) => setProdutoAtual({ ...produtoAtual, nome: t })} />
            </View>
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                <Text style={styles.labelField}>PREÇO UN/KG (R$)</Text>
                <TextInput style={styles.inputModal} placeholderTextColor={color.textSecondary} keyboardType="numeric" placeholder="0,00" value={produtoAtual.preco} onChangeText={(t) => setProdutoAtual({ ...produtoAtual, preco: t.replace(",", ".") })} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.labelField}>QTD / KG</Text>
                <TextInput style={styles.inputModal} placeholderTextColor={color.textSecondary} keyboardType="numeric" placeholder="1" value={produtoAtual.qtd} onChangeText={(t) => setProdutoAtual({ ...produtoAtual, qtd: t.replace(",", ".") })} />
              </View>
            </View>

            <Text style={styles.labelField}>CATEGORIA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CATEGORIAS.map((cat) => (
                <TouchableOpacity key={cat} style={[styles.catPill, produtoAtual.categoria === cat && styles.catPillActive]} onPress={() => { Haptics.selectionAsync(); setProdutoAtual({ ...produtoAtual, categoria: cat }); }}>
                  <Text style={[styles.catText, produtoAtual.categoria === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.labelField}>COMPROVANTES VISUAIS (PROVAS)</Text>
            <View style={styles.rowFotos}>
              <View style={styles.boxFotoContainer}>
                <TouchableOpacity style={styles.boxFoto} onPress={() => { Haptics.selectionAsync(); fotoProduto ? setFotoAmpliada(fotoProduto.uri) : setModoTirarFoto("produto"); }}>
                  {fotoProduto ? (<Image source={{ uri: fotoProduto.uri }} style={styles.imagePreview} />) : (<><Ionicons name="cube-outline" size={28} color={color.info} /><Text style={styles.textBtnFoto}>Produto</Text></>)}
                </TouchableOpacity>
                {fotoProduto && (
                  <TouchableOpacity style={styles.btnRemoverFoto} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFotoProduto(null); }}>
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.boxFotoContainer}>
                <TouchableOpacity style={styles.boxFoto} onPress={() => { Haptics.selectionAsync(); fotoEtiqueta ? setFotoAmpliada(fotoEtiqueta.uri) : setModoTirarFoto("etiqueta"); }}>
                  {fotoEtiqueta ? (<Image source={{ uri: fotoEtiqueta.uri }} style={styles.imagePreview} />) : (<><Ionicons name="pricetag-outline" size={28} color={color.info} /><Text style={styles.textBtnFoto}>Etiqueta</Text></>)}
                </TouchableOpacity>
                {fotoEtiqueta && (
                  <TouchableOpacity style={styles.btnRemoverFoto} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFotoEtiqueta(null); }}>
                    <Ionicons name="close" size={16} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.btnAdicionarCarrinho} onPress={salvarNoCarrinho}>
              <Text style={styles.textoBotaoBranco}>{editando ? "Atualizar Carrinho" : "Adicionar ao Carrinho"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};