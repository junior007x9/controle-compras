import React from 'react';
import { Modal, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RecargaModalProps {
  visivel: boolean;
  fecharModal: () => void;
  tipoOperacao: "adicionar" | "remover";
  valorRecarga: string;
  setValorRecarga: (valor: string) => void;
  confirmarRecarga: () => void;
  color: any;
  styles: any;
}

export const RecargaModal = ({ visivel, fecharModal, tipoOperacao, valorRecarga, setValorRecarga, confirmarRecarga, color, styles }: RecargaModalProps) => {
  return (
    <Modal visible={visivel} animationType="fade" transparent={true} onRequestClose={fecharModal}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdropCentral}>
        <View style={styles.modalContentCentral}>
          <Ionicons
            name={tipoOperacao === "adicionar" ? "wallet" : "cash-outline"}
            size={48}
            color={tipoOperacao === "adicionar" ? color.tint : color.danger}
            style={{ marginBottom: 16 }}
          />
          <Text style={styles.modalTituloCentral}>
            {tipoOperacao === "adicionar" ? "Adicionar Saldo" : "Remover Saldo"}
          </Text>
          <TextInput
            style={[styles.inputGigante, { color: tipoOperacao === "adicionar" ? color.tint : color.danger }]}
            placeholder="R$ 0,00"
            placeholderTextColor={color.textSecondary}
            keyboardType="numeric"
            value={valorRecarga}
            onChangeText={setValorRecarga}
          />
          <TouchableOpacity
            onPress={confirmarRecarga}
            style={[styles.btnConfirmarDep, { backgroundColor: tipoOperacao === "adicionar" ? color.tint : color.danger }]}
          >
            <Text style={styles.textoBotaoBranco}>
              {tipoOperacao === "adicionar" ? "Confirmar Depósito" : "Confirmar Remoção"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={fecharModal} style={{ padding: 10 }}>
            <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};