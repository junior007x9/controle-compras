import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CameraModalProps {
  modoTirarFoto: "produto" | "etiqueta" | null;
  setModoTirarFoto: (modo: "produto" | "etiqueta" | null) => void;
  flashLigado: boolean;
  setFlashLigado: (ligado: boolean) => void;
  cameraShotRef: any;
  capturarFotoPelaCamera: () => void;
  styles: any;
}

export const CameraModal = ({ modoTirarFoto, setModoTirarFoto, flashLigado, setFlashLigado, cameraShotRef, capturarFotoPelaCamera, styles }: CameraModalProps) => {
  return (
    <Modal
      visible={modoTirarFoto !== null}
      animationType="fade"
      onRequestClose={() => {
        setModoTirarFoto(null);
        setFlashLigado(false);
      }}
    >
      <View style={{ flex: 1, backgroundColor: "black" }}>
        <CameraView style={StyleSheet.absoluteFillObject} facing="back" ref={cameraShotRef} enableTorch={flashLigado} />
        <SafeAreaView style={[StyleSheet.absoluteFillObject, styles.overlayPreviaFoto]} pointerEvents="box-none">
          <View style={styles.headerPrevia}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setFlashLigado(!flashLigado);
              }}
              style={{ padding: 10 }}
            >
              <Ionicons name={flashLigado ? "flash" : "flash-off"} size={24} color={flashLigado ? "#FFC857" : "white"} />
            </TouchableOpacity>
            <Text style={styles.textoHeaderPrevia}>
              Foto: {modoTirarFoto === "produto" ? "Produto" : "Etiqueta"}
            </Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.footerPrevia}>
            <TouchableOpacity
              style={styles.btnCancelarFoto}
              onPress={() => {
                setModoTirarFoto(null);
                setFlashLigado(false);
              }}
            >
              <Text style={styles.textoBotaoBranco}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnShutter} onPress={capturarFotoPelaCamera}>
              <View style={styles.shutterInternal} />
            </TouchableOpacity>
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};