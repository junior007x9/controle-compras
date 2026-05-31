import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCartStore } from '../store/useCartStore';

export function BotaoLerNota({ color }: { color: any }) {
  const [loading, setLoading] = useState(false);
  const adicionarVariosItens = useCartStore((state) => state.adicionarVariosItens);

  const lerNotaFiscal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 1. Solicita permissão da câmera
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Atenção', 'Precisamos da permissão da câmera para ler a nota.');
      return;
    }

    // 2. Abre a câmera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, // Permite cortar a foto para focar na nota
      quality: 0.8,
    });

    if (!result.canceled) {
      setLoading(true);
      try {
        // 3. Comprime a imagem (MUITO importante para a IA ser rápida e não gastar 4G)
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        // 4. Chama a função da IA no Firebase
        const functions = getFunctions();
        const processarNota = httpsCallable(functions, 'processarNotaFiscal');
        
        // Passa a imagem em base64
        const response = await processarNota({ image: manipResult.base64 });
        const dadosExtraidos = response.data as any;

        if (dadosExtraidos && dadosExtraidos.itens) {
          // 5. Salva tudo no Zustand e no Turso
          await adicionarVariosItens(dadosExtraidos.itens);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Mágica Concluída! 🪄", `Foram lidos e adicionados ${dadosExtraidos.itens.length} itens ao teu carrinho.`);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert("Aviso", "A IA não conseguiu identificar os itens nesta foto. Tente tirar uma foto mais nítida.");
        }

      } catch (error) {
        console.error("Erro ao ler nota:", error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Erro", "Falha de conexão com a Inteligência Artificial.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.botao, { backgroundColor: color.info }]} 
      onPress={lerNotaFiscal} 
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#FFF" size="small" />
          <Text style={styles.textoBotao}>A IA está a ler a nota...</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <Ionicons name="sparkles" size={20} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.textoBotao}>Foto Inteligente (IA)</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textoBotao: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});