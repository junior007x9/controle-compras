import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { CameraView, BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CameraModalProps {
  modoTirarFoto: "produto" | "etiqueta" | "nota" | null;
  setModoTirarFoto: (modo: "produto" | "etiqueta" | "nota" | null) => void;
  flashLigado: boolean;
  setFlashLigado: (ligado: boolean) => void;
  cameraShotRef: any;
  capturarFotoPelaCamera: () => void;
  styles: any;
  onScanNota?: (url: string) => void;
}

export const CameraModal = ({ 
  modoTirarFoto, 
  setModoTirarFoto, 
  flashLigado, 
  setFlashLigado, 
  cameraShotRef, 
  capturarFotoPelaCamera, 
  styles,
  onScanNota
}: CameraModalProps) => {

  const [isScanned, setIsScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult) => {
    if (isScanned || modoTirarFoto !== "nota") return;
    
    let urlEscaneada = data.trim();
    
    // Sua correção mantida: Muitos QR Codes vêm sem o https://
    if (urlEscaneada.startsWith('www.')) {
      urlEscaneada = 'https://' + urlEscaneada;
    }

    if (urlEscaneada.startsWith('http://') || urlEscaneada.startsWith('https://')) {
      setIsScanned(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (onScanNota) {
        onScanNota(urlEscaneada);
      }
      
      setTimeout(() => {
        setIsScanned(false);
        setModoTirarFoto(null);
        setFlashLigado(false);
      }, 500);
    }
  };

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
        <CameraView 
          style={StyleSheet.absoluteFillObject} 
          facing="back" 
          ref={cameraShotRef} 
          enableTorch={flashLigado} 
          barcodeScannerSettings={modoTirarFoto === "nota" ? { barcodeTypes: ["qr"] } : undefined}
          onBarcodeScanned={modoTirarFoto === "nota" && !isScanned ? handleBarcodeScanned : undefined}
        />
        
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
              {modoTirarFoto === "nota" ? "Ler QR Code da Nota" : `Foto: ${modoTirarFoto === "produto" ? "Produto" : "Etiqueta"}`}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Mira centralizada que você criou (Apenas no modo nota) */}
          {modoTirarFoto === "nota" && (
            <View style={localStyles.overlayMiras} pointerEvents="none">
              <Ionicons name="scan-outline" size={250} color="rgba(255,255,255,0.5)" />
              <Text style={localStyles.textoMira}>Aponte para o QR Code</Text>
            </View>
          )}

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
            
            {/* Ocultar o botão de tirar foto se for QR Code */}
            {modoTirarFoto !== "nota" ? (
              <TouchableOpacity style={styles.btnShutter} onPress={capturarFotoPelaCamera}>
                <View style={styles.shutterInternal} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 60, height: 60 }} />
            )}
            
            <View style={{ width: 80 }} />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// Estilos extras para a mira do QR Code
const localStyles = StyleSheet.create({
  overlayMiras: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoMira: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden'
  }
});