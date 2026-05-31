import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

// 🔥 O CÉREBRO: Dicionário Inteligente importado do Planejamento
const DICIONARIO_INTELIGENTE: Record<string, string[]> = {
  Alimentação: [
    "arroz", "feijão", "macarrão", "carne", "frango", "peixe", "ovo", "óleo", "azeite",
    "sal", "açúcar", "café", "pão", "bolo", "bolacha", "biscoito", "queijo", "presunto",
    "manteiga", "margarina", "iogurte", "fruta", "legume", "verdura", "batata", "cebola",
    "alho", "tomate", "farinha", "leite em pó", "molho"
  ],
  Limpeza: [
    "sabão", "detergente", "amaciante", "desinfetante", "esponja", "vassoura", "rodo", 
    "saco", "lixo", "cloro", "água sanitária", "desengordurante", "pano", "multiuso", "álcool"
  ],
  Higiene: [
    "shampoo", "condicionador", "sabonete", "pasta", "escova", "desodorante", "papel higiênico", 
    "absorvente", "barbeador", "fio dental", "cotonete", "creme", "fralda", "lenço"
  ],
  Bebidas: [
    "leite", "refrigerante", "suco", "água", "cerveja", "vinho", "chá", "energético", "vodka", "licor"
  ],
};

export function ProdutoModal({
  visivel,
  fecharModal,
  editando,
  produtoAtual,
  setProdutoAtual,
  precoAnterior,
  fotoProduto,
  fotoEtiqueta,
  setModoTirarFoto,
  salvarNoCarrinho,
  color,
}: any) {
  const insets = useSafeAreaInsets();
  const [usarCalcPeso, setUsarCalcPeso] = useState(false);
  const [precoKg, setPrecoKg] = useState("");
  const [pesoGramas, setPesoGramas] = useState("");

  const categorias = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

  // 🧠 OLHEIRO INTELIGENTE: Fica a vigiar o nome do produto enquanto digitas
  useEffect(() => {
    if (produtoAtual.nome) {
      const textoMinusculo = produtoAtual.nome.toLowerCase();
      
      for (const [categoria, palavras] of Object.entries(DICIONARIO_INTELIGENTE)) {
        if (palavras.some((palavra) => textoMinusculo.includes(palavra))) {
          // Só muda se a categoria for diferente da atual, para evitar loops
          if (produtoAtual.categoria !== categoria) {
            setProdutoAtual((prev: any) => ({ ...prev, categoria: categoria }));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Dá uma micro vibração quando adivinha!
          }
          break; // Se encontrou, para de procurar
        }
      }
    }
  }, [produtoAtual.nome]);

  // Cálculos de Peso/Unidade originais mantidos
  useEffect(() => {
    if (usarCalcPeso && precoKg && pesoGramas) {
      const precoPorKgNum = parseFloat(precoKg.replace(",", "."));
      const pesoGramasNum = parseFloat(pesoGramas.replace(",", "."));
      
      if (!isNaN(precoPorKgNum) && !isNaN(pesoGramasNum)) {
        const valorFinal = (precoPorKgNum * pesoGramasNum) / 1000;
        setProdutoAtual((prev: any) => ({ ...prev, preco: valorFinal.toFixed(2), qtd: "1" }));
      }
    }
  }, [precoKg, pesoGramas, usarCalcPeso]);

  return (
    <Modal visible={visivel} transparent={true} animationType="slide" onRequestClose={fecharModal}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: color.card, borderColor: color.border, paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
              
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: color.text }]}>
                  {editando ? "Editar Produto" : "Novo Produto"}
                </Text>
                <TouchableOpacity onPress={fecharModal} style={{ padding: 4 }}>
                  <Ionicons name="close" size={28} color={color.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                showsVerticalScrollIndicator={false} 
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 100 }}
              >
                <Text style={[styles.label, { color: color.textSecondary }]}>Nome do Produto</Text>
                <TextInput
                  style={[styles.inputLarge, { backgroundColor: color.background, color: color.text }]}
                  placeholder="Ex: Arroz 5kg"
                  placeholderTextColor={color.textSecondary}
                  value={produtoAtual.nome}
                  onChangeText={(t) => setProdutoAtual({ ...produtoAtual, nome: t })}
                />

                <View style={styles.toggleContainer}>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, !usarCalcPeso && { backgroundColor: color.tint }]}
                    onPress={() => setUsarCalcPeso(false)}
                  >
                    <Text style={[styles.toggleText, !usarCalcPeso && { color: "white" }]}>Unidade</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.toggleBtn, usarCalcPeso && { backgroundColor: color.tint }]}
                    onPress={() => setUsarCalcPeso(true)}
                  >
                    <Text style={[styles.toggleText, usarCalcPeso && { color: "white" }]}>Peso (Kg/g)</Text>
                  </TouchableOpacity>
                </View>

                {usarCalcPeso ? (
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Preço do Kg (R$)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: color.background, color: color.text }]}
                        placeholder="0,00"
                        placeholderTextColor={color.textSecondary}
                        keyboardType="numeric"
                        value={precoKg}
                        onChangeText={setPrecoKg}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Peso (Gramas)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: color.background, color: color.text }]}
                        placeholder="Ex: 450"
                        placeholderTextColor={color.textSecondary}
                        keyboardType="numeric"
                        value={pesoGramas}
                        onChangeText={setPesoGramas}
                      />
                    </View>
                  </View>
                ) : (
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Preço (R$)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: color.background, color: color.text }]}
                        placeholder="0,00"
                        placeholderTextColor={color.textSecondary}
                        keyboardType="numeric"
                        value={produtoAtual.preco}
                        onChangeText={(t) => setProdutoAtual({ ...produtoAtual, preco: t })}
                      />
                    </View>
                    <View style={{ width: 80 }}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Qtd</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: color.background, color: color.text, textAlign: "center" }]}
                        keyboardType="numeric"
                        value={produtoAtual.qtd}
                        onChangeText={(t) => setProdutoAtual({ ...produtoAtual, qtd: t })}
                      />
                    </View>
                  </View>
                )}

                {precoAnterior && (
                  <View style={styles.precoAnteriorBox}>
                    <Ionicons name="information-circle" size={20} color="#FFC857" style={{ marginRight: 8 }} />
                    <Text style={{ color: color.text, fontSize: 12, flex: 1 }}>
                      Última vez pagaste <Text style={{ fontWeight: "bold" }}>R$ {Number(precoAnterior.preco_prateleira).toFixed(2)}</Text> em {precoAnterior.mes_referencia}.
                    </Text>
                  </View>
                )}

                <Text style={[styles.label, { color: color.textSecondary, marginTop: 16 }]}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {categorias.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catTag,
                        { backgroundColor: color.background },
                        produtoAtual.categoria === cat && { backgroundColor: color.tint, borderColor: color.tint }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setProdutoAtual({ ...produtoAtual, categoria: cat });
                      }}
                    >
                      <Text style={[styles.catText, { color: color.textSecondary }, produtoAtual.categoria === cat && { color: "white", fontWeight: "bold" }]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: color.textSecondary }]}>Comprovativos (Opcional)</Text>
                <View style={styles.rowFotos}>
                  <TouchableOpacity style={[styles.btnFoto, { backgroundColor: color.background }]} onPress={() => setModoTirarFoto("produto")}>
                    {fotoProduto ? <Image source={{ uri: fotoProduto.uri }} style={styles.fotoThumb} /> : <><Ionicons name="camera-outline" size={24} color={color.textSecondary} /><Text style={[styles.textoFoto, { color: color.textSecondary }]}>Foto Produto</Text></>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnFoto, { backgroundColor: color.background }]} onPress={() => setModoTirarFoto("etiqueta")}>
                    {fotoEtiqueta ? <Image source={{ uri: fotoEtiqueta.uri }} style={styles.fotoThumb} /> : <><Ionicons name="pricetag-outline" size={24} color={color.textSecondary} /><Text style={[styles.textoFoto, { color: color.textSecondary }]}>Foto Etiqueta</Text></>}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={[styles.btnSalvar, { backgroundColor: color.tint }]} 
                  onPress={salvarNoCarrinho}
                >
                  <Text style={styles.btnSalvarTexto}>Adicionar ao Carrinho</Text>
                </TouchableOpacity>

              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, maxHeight: "92%", borderWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "bold" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  inputLarge: { borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  input: { borderRadius: 12, padding: 14, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  toggleContainer: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleText: { fontSize: 14, fontWeight: "bold", color: "#666" },
  precoAnteriorBox: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 200, 87, 0.1)", padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255, 200, 87, 0.3)" },
  catTag: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: "transparent" },
  catText: { fontSize: 13 },
  rowFotos: { flexDirection: "row", gap: 12, marginBottom: 24 },
  btnFoto: { flex: 1, height: 80, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "transparent", borderStyle: "dashed" },
  textoFoto: { fontSize: 12, marginTop: 4 },
  fotoThumb: { width: "100%", height: "100%", borderRadius: 12 },
  btnSalvar: { padding: 16, borderRadius: 16, alignItems: "center", marginTop: 10, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  btnSalvarTexto: { color: "white", fontWeight: "bold", fontSize: 16 },
});