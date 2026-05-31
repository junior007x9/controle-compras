import React, { useState } from 'react';
import { Modal, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

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
  const [animando, setAnimando] = useState(false);

  const handleFinalizar = () => {
    // Se o nome do mercado estiver vazio, chama a função original logo para ela disparar o Alerta de Erro
    if (!nomeMercado.trim()) {
      return confirmarCompra();
    }

    // Se estiver tudo certo, esconde os botões e mostra a animação de sucesso!
    setAnimando(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Espera a animação rodar por 2.5 segundos, fecha tudo e guarda no histórico
    setTimeout(() => {
      setAnimando(false);
      confirmarCompra();
    }, 2500);
  };

  return (
    <Modal visible={visivel} animationType="fade" transparent={true} onRequestClose={fecharModal}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdropCentral}>
        <View style={styles.modalContentCentral}>
          
          {animando ? (
            // A TELA DA ANIMAÇÃO MÁGICA
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 20 }}>
              <LottieView
                source={{ uri: "https://lottie.host/93385732-e0ba-4fc7-bba2-581d6837ebfe/kntA0zRjY0.json" }} 
                autoPlay
                loop={false}
                style={{ width: 160, height: 160 }}
              />
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: color.tint, marginTop: 10 }}>Tudo Certo!</Text>
              <Text style={{ color: color.textSecondary, marginTop: 5 }}>A guardar no histórico vitalício...</Text>
            </View>
          ) : (
            // O FORMULÁRIO NORMAL
            <>
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
              <TouchableOpacity onPress={handleFinalizar} style={[styles.btnConfirmarDep, { backgroundColor: color.tint }]}>
                <Text style={styles.textoBotaoBranco}>Finalizar Compra</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={fecharModal} style={{ padding: 10 }}>
                <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};