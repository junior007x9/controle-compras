import React, { useState, useEffect } from 'react';
import { Modal, KeyboardAvoidingView, View, Text, TextInput, TouchableOpacity, Platform, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { turso } from '../../database';
import { useAuthStore } from '../../store/useAuthStore';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visivel: boolean;
  fecharModal: () => void;
  color: any;
}

export const HistoricoBuscaModal = ({ visivel, fecharModal, color }: Props) => {
  const { familiaId } = useAuthStore();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Limpa a busca sempre que fechar a janela
  useEffect(() => {
    if (!visivel) {
      setBusca('');
      setResultados([]);
    }
  }, [visivel]);

  // Pesquisa em tempo real (com "debounce" para não travar o telemóvel)
  useEffect(() => {
    const buscarDados = async () => {
      if (busca.trim().length < 2) {
        setResultados([]);
        return;
      }
      setLoading(true);
      try {
        const res = await turso.execute({
          sql: "SELECT * FROM compras_historico WHERE familia_id = ? AND nome_produto LIKE ? ORDER BY data_compra DESC LIMIT 50",
          args: [familiaId || "", `%${busca}%`]
        });
        setResultados(res.rows as any[]);
      } catch (e) {
        console.error("Erro na busca de histórico", e);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(buscarDados, 400); // Espera o utilizador parar de digitar por 400ms
    return () => clearTimeout(timeoutId);
  }, [busca, familiaId]);

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.nome, { color: color.text }]} numberOfLines={1}>{item.nome_produto}</Text>
        <Text style={[styles.mercado, { color: color.textSecondary }]}>
          <Ionicons name="storefront-outline" size={12} /> {item.supermercado || 'Supermercado'} • {new Date(item.data_compra).toLocaleDateString('pt-BR')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
        <Text style={[styles.preco, { color: color.tint }]}>R$ {Number(item.preco_prateleira).toFixed(2)}</Text>
        <Text style={{ fontSize: 10, color: color.textSecondary, marginTop: 2, fontWeight: 'bold' }}>{item.categoria.toUpperCase()}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visivel} animationType="slide" transparent={false} onRequestClose={fecharModal}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          
          <View style={[styles.header, { borderBottomColor: color.border }]}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); fecharModal(); }} style={{ padding: 5 }}>
              <Ionicons name="chevron-down" size={32} color={color.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: color.text }]}>Detetive de Preços</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={styles.searchContainer}>
            <View style={[styles.inputBox, { backgroundColor: color.card, borderColor: color.border }]}>
              <Ionicons name="search" size={20} color={color.tint} />
              <TextInput
                style={[styles.input, { color: color.text }]}
                placeholder="Pesquisar histórico (Ex: Café...)"
                placeholderTextColor={color.textSecondary}
                value={busca}
                onChangeText={setBusca}
                autoFocus={true}
              />
              {busca.length > 0 && (
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setBusca(''); }} style={{ padding: 5 }}>
                  <Ionicons name="close-circle" size={20} color={color.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={color.tint} />
              <Text style={{ color: color.textSecondary, marginTop: 12, fontWeight: '500' }}>A investigar o histórico...</Text>
            </View>
          ) : (
            <FlatList
              data={resultados}
              keyExtractor={(item, index) => `${item.id || index}`}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.center}>
                  <Ionicons name="search-outline" size={70} color={color.border} style={{ marginBottom: 16 }} />
                  <Text style={{ color: color.textSecondary, textAlign: 'center', fontSize: 16, lineHeight: 22 }}>
                    {busca.length < 2 
                      ? "Digita o nome do produto para comparar os preços e saber onde o compraste mais barato." 
                      : "Ainda não compraste nenhum produto com este nome."}
                  </Text>
                </View>
              }
            />
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: 'bold' },
  searchContainer: { padding: 20, paddingBottom: 5 },
  inputBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  input: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, fontSize: 16, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  nome: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  mercado: { fontSize: 13, fontWeight: '600' },
  preco: { fontSize: 18, fontWeight: '900', marginBottom: 2 },
});