import React from 'react';
import { Modal, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FotoAmpliadaModalProps {
  fotoAmpliada: string | null;
  setFotoAmpliada: (foto: string | null) => void;
}

export const FotoAmpliadaModal = ({ fotoAmpliada, setFotoAmpliada }: FotoAmpliadaModalProps) => {
  return (
    <Modal visible={fotoAmpliada !== null} transparent={true} animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
        <TouchableOpacity style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 10 }} onPress={() => setFotoAmpliada(null)}>
          <Ionicons name="close-circle" size={40} color="white" />
        </TouchableOpacity>
        {fotoAmpliada && <Image source={{ uri: fotoAmpliada }} style={{ width: "100%", height: "80%", resizeMode: "contain" }} />}
      </View>
    </Modal>
  );
};