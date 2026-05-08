import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCartStore } from '../store/useCartStore';

export function BotaoLerNota() {
  const [loading, setLoading] = useState(false);
  const adicionarVariosItens = useCartStore((state) => state.adicionarVariosItens);

  const lerNotaFiscal = async () => {
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
          Alert.alert("Mágica Concluída!", `Foram lidos e adicionados ${dadosExtraidos.itens.length} itens.`);
        } else {
          Alert.alert("Aviso", "A IA não conseguiu identificar os itens nesta foto. Tente novamente.");
        }

      } catch (error) {
        console.error("Erro ao ler nota:", error);
        Alert.alert("Erro", "Falha ao processar a nota fiscal com a IA.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <TouchableOpacity style={styles.botao} onPress={lerNotaFiscal} disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <Text style={styles.textoBotao}>📸 Escanear Nota Fiscal</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    backgroundColor: '#10B981', // Um verde bonito e moderno
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  textoBotao: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});