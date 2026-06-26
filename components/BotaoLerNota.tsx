import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export function BotaoLerNota({ color, onPress }: { color: any, onPress: () => void }) {
  return (
    <TouchableOpacity 
      style={[styles.botao, { backgroundColor: color.info }]} 
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }} 
      activeOpacity={0.8}
    >
      <View style={styles.contentContainer}>
        <Ionicons name="qr-code-outline" size={22} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.textoBotao}>Ler QR Code da Nota (Sefaz)</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
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
  textoBotao: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});