import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useThemeStore } from "../../store/useThemeStore";
import { useAuthStore } from "../../store/useAuthStore";

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

const DICIONARIO_INTELIGENTE: Record<string, string[]> = {
  Alimentação: [
    "arroz", "feijão", "macarrão", "carne", "frango", "peixe", "ovo", "óleo", "azeite",
    "sal", "açúcar", "café", "pão", "bolo", "bolacha", "biscoito", "queijo", "presunto",
    "manteiga", "margarina", "iogurte", "fruta", "legume", "verdura", "batata", "cebola",
    "alho", "tomate", "farinha", "leite em pó", "molho"
  ],
  Limpeza: [
    "sabão", "detergente", "amaciante", "desinfetante", "esponja", "vassoura", "rodo", 
    "saco", "lixo", "cloro", "água sanitária", "desengordurante", "pano", "multiuso", "álcool"
  ],
  Higiene: [
    "shampoo", "condicionador", "sabonete", "pasta", "escova", "desodorante", "papel higiênico", 
    "absorvente", "barbeador", "fio dental", "cotonete", "creme", "fralda", "lenço"
  ],
  Bebidas: [
    "leite", "refrigerante", "suco", "água", "cerveja", "vinho", "chá", "energético", "vodka", "licor"
  ],
};

interface ChecklistItem {
  id: string;
  nome: string;
  categoria: string;
  comprado: boolean;
}

export default function ListaScreen() {
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);
  const router = useRouter();

  const { familiaId, usuario } = useAuthStore();

  useEffect(() => {
    if (!usuario || !familiaId) {
      router.replace("/");
    }
  }, [usuario, familiaId]);

  const [novoItem, setNovoItem] = useState("");
  const [categoriaAtual, setCategoriaAtual] = useState("Alimentação");
  const [lista, setLista] = useState<ChecklistItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  const [estaGravando, setEstaGravando] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useSpeechRecognitionEvent("start", () => setEstaGravando(true));
  useSpeechRecognitionEvent("end", () => setEstaGravando(false));

  useSpeechRecognitionEvent("result", (event) => {
    const textoFalado = event.results[0]?.transcript;
    if (textoFalado) {
      setNovoItem(textoFalado);
      executarDicionarioLocal(textoFalado);
      adicionarItem(textoFalado); 
      setEstaGravando(false);
      ExpoSpeechRecognitionModule.stop();
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setEstaGravando(false);
    if (event.error !== "no-speech" && event.error !== "audio-capture") {
      Alert.alert("Aviso de Sistema", `Detalhe técnico: ${event.error}`);
    }
  });

  const alternarGravacaoVoz = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (estaGravando) {
      try {
        ExpoSpeechRecognitionModule.stop();
        setEstaGravando(false);
      } catch (e) {}
    } else {
      try {
        const { granted } = await Audio.requestPermissionsAsync();
        
        if (!granted) {
          Alert.alert("Permissão Negada", "Precisas permitir o microfone nas definições do teu celular.");
          return;
        }

        setNovoItem("");
        setEstaGravando(true);
        ExpoSpeechRecognitionModule.start({ lang: "pt-BR" });
      } catch (e: any) {
        setEstaGravando(false);
        Alert.alert("Erro", `Não consegui iniciar: ${e.message}`);
      }
    }
  };

  const sincronizarListaDaNuvem = async () => {
    if (!familiaId) return; 
    try {
      await turso.execute(
        "CREATE TABLE IF NOT EXISTS checklist (id TEXT PRIMARY KEY, nome TEXT, categoria TEXT, comprado INTEGER, familia_id TEXT)",
      );

      const result = await turso.execute({
        sql: "SELECT * FROM checklist WHERE familia_id = ?",
        args: [familiaId]
      });

      const listaFormatada = result.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        categoria: String(row.categoria),
        comprado: Boolean(row.comprado),
      }));

      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(listaFormatada));
      setLista(listaFormatada);
    } catch (e) {
      const cacheLocal = await AsyncStorage.getItem(`dehouse_checklist_${familiaId}`);
      if (cacheLocal) setLista(JSON.parse(cacheLocal));
    }
  };

  useFocusEffect(
    useCallback(() => {
      sincronizarListaDaNuvem();
    }, [familiaId]),
  );

  const onRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await sincronizarListaDaNuvem();
    setRefreshing(false);
  };

  const executarDicionarioLocal = (texto: string) => {
    const textoMinusculo = texto.toLowerCase();
    let categoriaEncontrada = "";
    for (const [categoria, palavras] of Object.entries(DICIONARIO_INTELIGENTE)) {
      if (palavras.some((palavra) => textoMinusculo.includes(palavra))) {
        categoriaEncontrada = categoria;
        break;
      }
    }
    if (categoriaEncontrada) {
      setCategoriaAtual(categoriaEncontrada);
    }
  };

  const handleMudancaTexto = (texto: string) => {
    setNovoItem(texto);
    executarDicionarioLocal(texto);
  };

  const adicionarItem = async (textoVoz?: string | any) => {
    const textoFinal = typeof textoVoz === 'string' ? textoVoz : novoItem;
    
    if (textoFinal.trim() === "" || !familiaId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();

    const nomeLimpo = textoFinal.trim();
    let categoriaDefinida = categoriaAtual;

    const dicionarioAchou = Object.entries(DICIONARIO_INTELIGENTE).find(([_, palavras]) =>
      palavras.some(p => nomeLimpo.toLowerCase().includes(p))
    );

    if (dicionarioAchou) {
      categoriaDefinida = dicionarioAchou[0];
    }

    const item: ChecklistItem = {
      id: Date.now().toString(),
      nome: nomeLimpo,
      categoria: categoriaDefinida,
      comprado: false,
    };

    const novaLista = [item, ...lista];
    setLista(novaLista); 
    setNovoItem("");
    setCategoriaAtual(categoriaDefinida); 

    try {
      await turso.execute({
        sql: "INSERT INTO checklist (id, nome, categoria, comprado, familia_id) VALUES (?, ?, ?, ?, ?)",
        args: [item.id, item.nome, item.categoria, 0, familiaId],
      });
      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(novaLista));
    } catch (e) {}
  };

  const alternarComprado = async (id: string) => {
    if (!familiaId) return;
    Haptics.selectionAsync();
    const item = lista.find((i) => i.id === id);
    if (!item) return;
    const novoEstado = !item.comprado;

    const novaLista = lista.map((i) => (i.id === id ? { ...i, comprado: novoEstado } : i));
    setLista(novaLista);

    try {
      await turso.execute({
        sql: "UPDATE checklist SET comprado = ? WHERE id = ? AND familia_id = ?",
        args: [novoEstado ? 1 : 0, id, familiaId],
      });
      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(novaLista));
    } catch (e) {}
  };

  const removerItem = async (id: string) => {
    if (!familiaId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    const novaLista = lista.filter((item) => item.id !== id);
    setLista(novaLista);

    try {
      await turso.execute({
        sql: "DELETE FROM checklist WHERE id = ? AND familia_id = ?",
        args: [id, familiaId],
      });
      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(novaLista));
    } catch (e) {}
  };

  const limparComprados = async () => {
    if (!familiaId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    const novaLista = lista.filter((item) => !item.comprado);
    setLista(novaLista);

    try {
      await turso.execute({
        sql: "DELETE FROM checklist WHERE comprado = 1 AND familia_id = ?",
        args: [familiaId]
      });
      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(novaLista));
    } catch (e) {}
  };

  const listaOrdenada = useMemo(() => {
    return [...lista].sort((a, b) => {
      if (a.comprado !== b.comprado) return a.comprado ? 1 : -1;
      return a.categoria.localeCompare(b.categoria);
    });
  }, [lista]);

  const renderItem = ({ item }: { item: ChecklistItem }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => alternarComprado(item.id)}
      style={[
        styles.cardComprovante,
        { backgroundColor: color.card, borderColor: color.border },
        item.comprado && styles.cardComprovanteComprado
      ]}
    >
      <View style={[styles.iconeLateral, { backgroundColor: item.comprado ? color.tint + '20' : color.background }]}>
        <Ionicons name={item.comprado ? "checkbox" : "square-outline"} size={24} color={item.comprado ? color.tint : color.textSecondary} />
      </View>

      <View style={styles.textosContainer}>
        <Text style={[styles.nomeItemCard, { color: color.text }, item.comprado && styles.textoRiscado]} numberOfLines={2}>
          {item.nome}
        </Text>
        <Text style={[styles.categoriaItemCard, { color: item.comprado ? color.textSecondary : color.tint }]}>
          {item.categoria}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.botaoApagarCard} 
        onPress={() => removerItem(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color={color.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.tituloTela}>Planejamento</Text>
            <Text style={styles.subtituloTela}>
              {lista.filter((i) => i.comprado).length} de {lista.length} itens pegos
            </Text>
          </View>
          {lista.filter((i) => i.comprado).length > 0 && (
            <TouchableOpacity onPress={limparComprados} style={styles.btnLimpar}>
              <Ionicons name="broom-outline" size={16} color={color.warning} />
              <Text style={styles.textoLimpar}>Limpar pegos</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={estaGravando ? "Ouvindo você..." : "Ex: Arroz, Detergente..."}
              placeholderTextColor={estaGravando ? color.tint : color.textSecondary}
              value={novoItem}
              onChangeText={handleMudancaTexto}
              onSubmitEditing={adicionarItem}
            />

            <TouchableOpacity 
              style={[styles.btnMicrofone, estaGravando && { backgroundColor: color.danger }]} 
              onPress={alternarGravacaoVoz}
            >
              <Ionicons name={estaGravando ? "mic" : "mic-outline"} size={22} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnAdicionar, { opacity: novoItem.trim() ? 1 : 0.5 }]}
              onPress={adicionarItem}
              disabled={!novoItem.trim()}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriasScroll}>
            {CATEGORIAS.map((cat) => (
              <TouchableOpacity key={cat} style={[styles.catPill, categoriaAtual === cat && styles.catPillActive]} onPress={() => { Haptics.selectionAsync(); setCategoriaAtual(cat); }}>
                <Text style={[styles.catText, categoriaAtual === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={listaOrdenada}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listaScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.tint} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="mic-outline" size={70} color={color.borderDark} />
              <Text style={styles.textoVazio}>Sua lista está vazia!</Text>
              <Text style={styles.subtextoVazio}>
                Digite um produto ou clique no microfone para falar o que deseja adicionar ao planejamento!
              </Text>
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 10 },
    tituloTela: { fontSize: 28, fontWeight: "bold", color: c.text },
    subtituloTela: { fontSize: 14, color: c.textSecondary, fontWeight: "600" },
    btnLimpar: { flexDirection: "row", alignItems: "center", backgroundColor: c.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 4 },
    textoLimpar: { color: c.warning, fontSize: 12, fontWeight: "bold" },
    formContainer: { paddingHorizontal: 20, marginBottom: 16 },
    inputRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    input: { flex: 1, backgroundColor: c.card, borderWidth: 1, borderColor: c.borderDark, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: c.text },
    btnMicrofone: { width: 54, height: 54, backgroundColor: '#3B82F6', borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    btnAdicionar: { width: 54, height: 54, backgroundColor: c.tint, borderRadius: 16, justifyContent: "center", alignItems: "center", elevation: 2 },
    categoriasScroll: { marginBottom: 4 },
    catPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: c.border, marginRight: 10, borderWidth: 1, borderColor: "transparent" },
    catPillActive: { backgroundColor: c.border, borderColor: c.tint, borderWidth: 1 },
    catText: { color: c.textSecondary, fontWeight: "600", fontSize: 13 },
    catTextActive: { color: c.tint },
    listaScroll: { paddingHorizontal: 20, paddingBottom: 40 },
    emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
    textoVazio: { color: c.text, fontSize: 18, fontWeight: "bold", marginTop: 16, textAlign: "center" },
    subtextoVazio: { color: c.textSecondary, fontSize: 15, marginTop: 8, textAlign: "center", lineHeight: 22 },
    cardComprovante: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      elevation: 2, 
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    cardComprovanteComprado: {
      backgroundColor: c.background, 
      opacity: 0.6,
      borderColor: c.borderDark,
      shadowOpacity: 0,
      elevation: 0,
    },
    iconeLateral: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    textosContainer: {
      flex: 1,
      marginRight: 8,
    },
    nomeItemCard: {
      fontSize: 15,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    textoRiscado: {
      textDecorationLine: "line-through",
      color: c.textSecondary,
    },
    categoriaItemCard: {
      fontSize: 12,
      fontWeight: '600',
    },
    botaoApagarCard: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 0, 0, 0.05)', 
    }
  });