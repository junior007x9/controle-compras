import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

export function OnboardingModal({ visivel, aoFechar, color }: any) {
  
  // Função que guarda na memória do telemóvel que o utilizador já viu o tutorial
  const concluirTutorial = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await AsyncStorage.setItem("@dehouse_tutorial_visto", "sim");
    aoFechar();
  };

  return (
    <Modal visible={visivel} transparent={true} animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: color.background }]}>
          <Ionicons name="rocket" size={48} color={color.tint} style={{ alignSelf: "center", marginBottom: 16 }} />
          <Text style={[styles.title, { color: color.text }]}>Bem-vindo ao Dehouse!</Text>
          <Text style={[styles.subtitle, { color: color.textSecondary }]}>
            O seu novo assistente de compras inteligente. Veja como começar:
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ width: "100%", maxHeight: 380 }}>
            {/* Passo 1 */}
            <View style={[styles.stepRow, { backgroundColor: color.card, borderColor: color.border }]}>
              <View style={[styles.iconBox, { backgroundColor: color.warning + "20" }]}>
                <Ionicons name="wallet-outline" size={24} color={color.warning} />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, { color: color.text }]}>1. Orçamento</Text>
                <Text style={[styles.stepDesc, { color: color.textSecondary }]}>Recarregue o "Cartão Dehouse" para definir o limite da sua compra antes de ir ao mercado.</Text>
              </View>
            </View>

            {/* Passo 2 */}
            <View style={[styles.stepRow, { backgroundColor: color.card, borderColor: color.border }]}>
              <View style={[styles.iconBox, { backgroundColor: color.tint + "20" }]}>
                <Ionicons name="barcode-outline" size={24} color={color.tint} />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, { color: color.text }]}>2. Escanear e Falar</Text>
                <Text style={[styles.stepDesc, { color: color.textSecondary }]}>Use a câmera para ler os códigos de barras ou o microfone para adicionar produtos em segundos.</Text>
              </View>
            </View>

            {/* Passo 3 */}
            <View style={[styles.stepRow, { backgroundColor: color.card, borderColor: color.border }]}>
              <View style={[styles.iconBox, { backgroundColor: color.info + "20" }]}>
                <Ionicons name="receipt-outline" size={24} color={color.info} />
              </View>
              <View style={styles.stepText}>
                <Text style={[styles.stepTitle, { color: color.text }]}>3. Histórico Inteligente</Text>
                <Text style={[styles.stepDesc, { color: color.textSecondary }]}>Ao finalizar, a compra é salva na nuvem. Da próxima vez, mostraremos quanto você pagou!</Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.button, { backgroundColor: color.tint }]} onPress={concluirTutorial}>
            <Text style={styles.buttonText}>Começar a Usar!</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", borderRadius: 24, padding: 24, alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 24, lineHeight: 20 },
  stepRow: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
  stepText: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  stepDesc: { fontSize: 13, lineHeight: 18 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%", padding: 16, borderRadius: 16, marginTop: 12, gap: 8 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "bold" }
});