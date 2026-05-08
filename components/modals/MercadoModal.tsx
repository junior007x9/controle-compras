import React from 'react';
import { Modal, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MercadoModalProps {
  visivel: boolean;
  fecharModal: () => void;
  nomeMercado: string;
  setNomeMercado: (nome: string) => void;
  confirmarCompra: () => void;
  color: any;
  styles: any;
}

export const MercadoModal = ({ visivel, fecharModal, nomeMercado, setNomeMercado, confirmarCompra, color, styles }: MercadoModalProps) => {
  return (
    <Modal visible={visivel} animationType="fade" transparent={true} onRequestClose={fecharModal}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdropCentral}>
        <View style={styles.modalContentCentral}>
          <Ionicons name="storefront" size={48} color={color.tint} style={{ marginBottom: 16 }} />
          <Text style={styles.modalTituloCentral}>Onde você está?</Text>
          <Text style={{ color: color.textSecondary, textAlign: "center", marginBottom: 20 }}>
            Isso ajuda a rastrear onde os produtos estão mais baratos no histórico.
          </Text>
          <TextInput
            style={[styles.inputModal, { width: "100%", marginBottom: 20, textAlign: "center" }]}
            placeholder="Ex: Assaí, Atacadão..."
            placeholderTextColor={color.textSecondary}
            value={nomeMercado}
            onChangeText={setNomeMercado}
          />
          <TouchableOpacity onPress={confirmarCompra} style={[styles.btnConfirmarDep, { backgroundColor: color.tint }]}>
            <Text style={styles.textoBotaoBranco}>Finalizar Compra</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={fecharModal} style={{ padding: 10 }}>
            <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};