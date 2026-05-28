import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function CalculadoraModal({ visivel, fecharModal, color }: any) {
  const [precoA, setPrecoA] = useState("");
  const [pesoA, setPesoA] = useState("");
  const [precoB, setPrecoB] = useState("");
  const [pesoB, setPesoB] = useState("");

  const calcularVantagem = () => {
    const pA = parseFloat(precoA.replace(",", "."));
    const gA = parseFloat(pesoA.replace(",", "."));
    const pB = parseFloat(precoB.replace(",", "."));
    const gB = parseFloat(pesoB.replace(",", "."));

    if (isNaN(pA) || isNaN(gA) || isNaN(pB) || isNaN(gB)) return null;

    const custoPorGramaA = pA / gA;
    const custoPorGramaB = pB / gB;

    if (custoPorGramaA === custoPorGramaB) return { texto: "Ambos têm o mesmo custo-benefício!", cor: color.info };

    const compensaMais = custoPorGramaA < custoPorGramaB ? "Produto A" : "Produto B";
    const diferenca = Math.abs((custoPorGramaA - custoPorGramaB) / Math.max(custoPorGramaA, custoPorGramaB)) * 100;

    return {
      texto: `O ${compensaMais} é mais vantajoso! Economizas ${diferenca.toFixed(1)}%.`,
      cor: "#10B981" // Verde sucesso
    };
  };

  const resultado = calcularVantagem();

  const limparCalculadora = () => {
    setPrecoA(""); setPesoA(""); setPrecoB(""); setPesoB("");
  };

  return (
    <Modal visible={visivel} transparent={true} animationType="slide" onRequestClose={fecharModal}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: color.card, borderColor: color.border }]}>
              
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="calculator" size={24} color={color.tint} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalTitle, { color: color.text }]}>Qual compensa mais?</Text>
                </View>
                <TouchableOpacity onPress={fecharModal}>
                  <Ionicons name="close" size={28} color={color.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={{ color: color.textSecondary, marginBottom: 20, fontSize: 13 }}>
                  Preenche os dados para saber qual produto sai mais barato por grama/litro.
                </Text>

                {/* Produto A */}
                <View style={[styles.produtoBox, { backgroundColor: color.background, borderColor: color.border }]}>
                  <Text style={[styles.produtoLabel, { color: color.text }]}>Produto A</Text>
                  <View style={styles.row}>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Preço (R$)</Text>
                      <TextInput style={[styles.input, { color: color.text, borderColor: color.border }]} placeholder="0,00" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={precoA} onChangeText={setPrecoA} />
                    </View>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Peso/Vol (g ou ml)</Text>
                      <TextInput style={[styles.input, { color: color.text, borderColor: color.border }]} placeholder="Ex: 500" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={pesoA} onChangeText={setPesoA} />
                    </View>
                  </View>
                </View>

                {/* Produto B */}
                <View style={[styles.produtoBox, { backgroundColor: color.background, borderColor: color.border }]}>
                  <Text style={[styles.produtoLabel, { color: color.text }]}>Produto B</Text>
                  <View style={styles.row}>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Preço (R$)</Text>
                      <TextInput style={[styles.input, { color: color.text, borderColor: color.border }]} placeholder="0,00" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={precoB} onChangeText={setPrecoB} />
                    </View>
                    <View style={styles.inputContainer}>
                      <Text style={[styles.label, { color: color.textSecondary }]}>Peso/Vol (g ou ml)</Text>
                      <TextInput style={[styles.input, { color: color.text, borderColor: color.border }]} placeholder="Ex: 800" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={pesoB} onChangeText={setPesoB} />
                    </View>
                  </View>
                </View>

                {/* Resultado */}
                {resultado ? (
                  <View style={[styles.resultadoBox, { backgroundColor: resultado.cor + "20", borderColor: resultado.cor }]}>
                    <Ionicons name="bulb-outline" size={24} color={resultado.cor} style={{ marginRight: 10 }} />
                    <Text style={[styles.resultadoTexto, { color: resultado.cor }]}>{resultado.texto}</Text>
                  </View>
                ) : (
                  <View style={{ height: 60 }} /> /* Espaço vazio para não saltar a tela */
                )}

                <TouchableOpacity style={[styles.btnSalvar, { backgroundColor: color.background, borderWidth: 1, borderColor: color.border }]} onPress={limparCalculadora}>
                  <Text style={[styles.btnSalvarTexto, { color: color.text }]}>Limpar Valores</Text>
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
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%", borderWidth: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "bold" },
  produtoBox: { padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  produtoLabel: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  row: { flexDirection: "row", gap: 12 },
  inputContainer: { flex: 1 },
  label: { fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  resultadoBox: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  resultadoTexto: { flex: 1, fontSize: 14, fontWeight: "bold" },
  btnSalvar: { padding: 16, borderRadius: 16, alignItems: "center", marginTop: 4 },
  btnSalvarTexto: { fontWeight: "bold", fontSize: 16 },
});