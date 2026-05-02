import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface CalculadoraModalProps {
  visivel: boolean;
  fecharModal: () => void;
  color: any;
}

export function CalculadoraModal({ visivel, fecharModal, color }: CalculadoraModalProps) {
  const [produtoA, setProdutoA] = useState({ preco: '', peso: '' });
  const [produtoB, setProdutoB] = useState({ preco: '', peso: '' });
  const [resultadoCalc, setResultadoCalc] = useState('');

  const calcularMaisBarato = () => {
    Haptics.selectionAsync();
    const pA = parseFloat(produtoA.preco.replace(',', '.')) / parseFloat(produtoA.peso.replace(',', '.'));
    const pB = parseFloat(produtoB.preco.replace(',', '.')) / parseFloat(produtoB.peso.replace(',', '.'));
    
    if (!pA || !pB) { setResultadoCalc('Preencha todos os campos!'); return; }
    
    if (pA < pB) setResultadoCalc(`O Produto A é ${(((pB - pA) / pB) * 100).toFixed(1)}% MAIS BARATO!`);
    else if (pB < pA) setResultadoCalc(`O Produto B é ${(((pA - pB) / pA) * 100).toFixed(1)}% MAIS BARATO!`);
    else setResultadoCalc('O preço por unidade é EXATAMENTE O MESMO!');
  };

  const limparEFechar = () => {
    setResultadoCalc('');
    setProdutoA({ preco: '', peso: '' });
    setProdutoB({ preco: '', peso: '' });
    fecharModal();
  };

  return (
    <Modal visible={visivel} animationType="fade" transparent={true} onRequestClose={limparEFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdropCentral}>
        <View style={[styles.modalContentCentral, { backgroundColor: color.card }]}>
          <Text style={[styles.modalTituloCentral, { color: color.text }]}>Calculadora de Economia</Text>
          
          <View style={{flexDirection: 'row', marginBottom: 16}}>
            <TextInput style={[styles.inputModal, { backgroundColor: color.border, color: color.text, flex: 1, marginRight: 8 }]} placeholder="Preço A" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={produtoA.preco} onChangeText={(t) => setProdutoA({...produtoA, preco: t})} />
            <TextInput style={[styles.inputModal, { backgroundColor: color.border, color: color.text, flex: 1 }]} placeholder="Peso A" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={produtoA.peso} onChangeText={(t) => setProdutoA({...produtoA, peso: t})} />
          </View>
          
          <View style={{flexDirection: 'row', marginBottom: 20}}>
            <TextInput style={[styles.inputModal, { backgroundColor: color.border, color: color.text, flex: 1, marginRight: 8 }]} placeholder="Preço B" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={produtoB.preco} onChangeText={(t) => setProdutoB({...produtoB, preco: t})} />
            <TextInput style={[styles.inputModal, { backgroundColor: color.border, color: color.text, flex: 1 }]} placeholder="Peso B" placeholderTextColor={color.textSecondary} keyboardType="numeric" value={produtoB.peso} onChangeText={(t) => setProdutoB({...produtoB, peso: t})} />
          </View>
          
          <TouchableOpacity onPress={calcularMaisBarato} style={{backgroundColor: '#1E1E1E', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16, width: '100%'}}>
            <Text style={{color: 'white', fontWeight: 'bold'}}>Qual compensa mais?</Text>
          </TouchableOpacity>
          
          {resultadoCalc !== '' && (
            <View style={{backgroundColor: color.border, padding: 16, borderRadius: 12, alignItems: 'center', width: '100%'}}>
              <Text style={{color: color.warning, fontWeight: 'bold', fontSize: 16, textAlign: 'center'}}>{resultadoCalc}</Text>
            </View>
          )}
          
          <TouchableOpacity onPress={limparEFechar} style={{marginTop: 20, alignItems: 'center', padding: 10}}>
            <Text style={{color: color.textSecondary, fontWeight: 'bold'}}>Fechar Calculadora</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdropCentral: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalContentCentral: { borderRadius: 24, padding: 24, alignItems: 'center' },
  modalTituloCentral: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  inputModal: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16, fontWeight: '500' },
});