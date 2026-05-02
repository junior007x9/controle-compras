import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
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
import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useThemeStore } from "../../store/useThemeStore"; // 🔥 TEMA ADICIONADO AQUI

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

const DICIONARIO_INTELIGENTE: Record<string, string[]> = {
  Limpeza: [
    "sabão",
    "detergente",
    "amaciante",
    "desinfetante",
    "esponja",
    "vassoura",
    "rodo",
    "saco",
    "lixo",
    "cloro",
    "água sanitária",
  ],
  Higiene: [
    "shampoo",
    "condicionador",
    "sabonete",
    "pasta",
    "escova",
    "desodorante",
    "papel higiênico",
    "absorvente",
    "barbeador",
  ],
  Bebidas: [
    "leite",
    "café",
    "refrigerante",
    "suco",
    "água",
    "cerveja",
    "vinho",
    "chá",
  ],
};

interface ChecklistItem {
  id: string;
  nome: string;
  categoria: string;
  comprado: boolean;
}

export default function ListaScreen() {
  // 🔥 GESTÃO DE TEMA ATUALIZADA
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);

  const [novoItem, setNovoItem] = useState("");
  const [categoriaAtual, setCategoriaAtual] = useState("Alimentação");
  const [lista, setLista] = useState<ChecklistItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const sincronizarListaDaNuvem = async () => {
    try {
      await turso.execute(
        "CREATE TABLE IF NOT EXISTS checklist (id TEXT PRIMARY KEY, nome TEXT, categoria TEXT, comprado INTEGER)",
      );
      const result = await turso.execute("SELECT * FROM checklist");

      const listaFormatada = result.rows.map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        categoria: String(row.categoria),
        comprado: Boolean(row.comprado),
      }));
      setLista(listaFormatada);
    } catch (e) {
      console.log("Erro ao sincronizar", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      sincronizarListaDaNuvem();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await sincronizarListaDaNuvem();
    setRefreshing(false);
  };

  const handleMudancaTexto = (texto: string) => {
    setNovoItem(texto);
    const textoMinusculo = texto.toLowerCase();

    for (const [categoria, palavras] of Object.entries(
      DICIONARIO_INTELIGENTE,
    )) {
      if (palavras.some((palavra) => textoMinusculo.includes(palavra))) {
        setCategoriaAtual(categoria);
        return;
      }
    }
    if (texto === "") setCategoriaAtual("Alimentação");
  };

  const adicionarItem = async () => {
    if (novoItem.trim() === "") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const item: ChecklistItem = {
      id: Date.now().toString(),
      nome: novoItem.trim(),
      categoria: categoriaAtual,
      comprado: false,
    };

    setLista([item, ...lista]); // Atualiza ecrã rápido
    setNovoItem("");
    setCategoriaAtual("Alimentação");
    Keyboard.dismiss();

    try {
      await turso.execute({
        sql: "INSERT INTO checklist (id, nome, categoria, comprado) VALUES (?, ?, ?, ?)",
        args: [item.id, item.nome, item.categoria, 0],
      });
    } catch (e) {}
  };

  const alternarComprado = async (id: string) => {
    Haptics.selectionAsync();
    const item = lista.find((i) => i.id === id);
    if (!item) return;
    const novoEstado = !item.comprado;

    setLista(
      lista.map((i) => (i.id === id ? { ...i, comprado: novoEstado } : i)),
    );

    try {
      await turso.execute({
        sql: "UPDATE checklist SET comprado = ? WHERE id = ?",
        args: [novoEstado ? 1 : 0, id],
      });
    } catch (e) {}
  };

  const removerItem = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLista(lista.filter((item) => item.id !== id));
    try {
      await turso.execute({
        sql: "DELETE FROM checklist WHERE id = ?",
        args: [id],
      });
    } catch (e) {}
  };

  const limparComprados = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLista(lista.filter((item) => !item.comprado));
    try {
      await turso.execute("DELETE FROM checklist WHERE comprado = 1");
    } catch (e) {}
  };

  const listaOrdenada = useMemo(() => {
    return [...lista].sort((a, b) => {
      if (a.comprado !== b.comprado) return a.comprado ? 1 : -1;
      return a.categoria.localeCompare(b.categoria);
    });
  }, [lista]);

  const renderItem = ({ item }: { item: ChecklistItem }) => (
    <View style={[styles.itemCard, item.comprado && styles.itemCardComprado]}>
      <TouchableOpacity
        style={styles.checkArea}
        onPress={() => alternarComprado(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.comprado ? "checkbox" : "square-outline"}
          size={26}
          color={item.comprado ? color.tint : color.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.itemNome, item.comprado && styles.itemNomeComprado]}
          >
            {item.nome}
          </Text>
          <Text
            style={[
              styles.itemCategoria,
              item.comprado && styles.itemCategoriaComprado,
            ]}
          >
            {item.categoria}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => removerItem(item.id)}
        style={styles.btnRemover}
      >
        <Ionicons name="trash-outline" size={20} color={color.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.tituloTela}>Planejamento</Text>
          <Text style={styles.subtituloTela}>
            {lista.filter((i) => i.comprado).length} de {lista.length} itens
            pegos
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
            placeholder="Ex: Leite, Sabão (Puxe para atualizar!)"
            placeholderTextColor={color.textSecondary}
            value={novoItem}
            onChangeText={handleMudancaTexto}
            onSubmitEditing={adicionarItem}
          />
          <TouchableOpacity
            style={[
              styles.btnAdicionar,
              { opacity: novoItem.trim() ? 1 : 0.5 },
            ]}
            onPress={adicionarItem}
            disabled={!novoItem.trim()}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriasScroll}
        >
          {CATEGORIAS.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.catPill,
                categoriaAtual === cat && styles.catPillActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setCategoriaAtual(cat);
              }}
            >
              <Text
                style={[
                  styles.catText,
                  categoriaAtual === cat && styles.catTextActive,
                ]}
              >
                {cat}
              </Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={color.tint}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ionicons
              name="cloud-done-outline"
              size={70}
              color={color.borderDark}
            />
            <Text style={styles.textoVazio}>Sua lista está vazia!</Text>
            <Text style={styles.subtextoVazio}>
              Puxe para baixo para sincronizar com sua parceira.
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      paddingTop: 10,
    },
    tituloTela: { fontSize: 28, fontWeight: "bold", color: c.text },
    subtituloTela: { fontSize: 14, color: c.textSecondary, fontWeight: "600" },
    btnLimpar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      gap: 4,
    },
    textoLimpar: { color: c.warning, fontSize: 12, fontWeight: "bold" },
    formContainer: { paddingHorizontal: 20, marginBottom: 16 },
    inputRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    input: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borderDark,
      borderRadius: 16,
      paddingHorizontal: 16,
      fontSize: 16,
      color: c.text,
    },
    btnAdicionar: {
      width: 54,
      height: 54,
      backgroundColor: c.tint,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
    },
    categoriasScroll: { marginBottom: 4 },
    catPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: c.border,
      marginRight: 10,
      borderWidth: 1,
      borderColor: "transparent",
    },
    catPillActive: {
      backgroundColor: c.border,
      borderColor: c.tint,
      borderWidth: 1,
    },
    catText: { color: c.textSecondary, fontWeight: "600", fontSize: 13 },
    catTextActive: { color: c.tint },
    listaScroll: { paddingHorizontal: 20, paddingBottom: 40 },
    itemCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    itemCardComprado: { backgroundColor: c.background, opacity: 0.6 },
    checkArea: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
    itemNome: { fontSize: 16, color: c.text, fontWeight: "bold", flex: 1 },
    itemNomeComprado: {
      textDecorationLine: "line-through",
      color: c.textSecondary,
    },
    itemCategoria: {
      fontSize: 12,
      color: c.tint,
      fontWeight: "600",
      marginTop: 2,
    },
    itemCategoriaComprado: { color: c.textSecondary },
    btnRemover: { padding: 8 },
    emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
    textoVazio: {
      color: c.text,
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 16,
      textAlign: "center",
    },
    subtextoVazio: {
      color: c.textSecondary,
      fontSize: 15,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 22,
    },
  });
