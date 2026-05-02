import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
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

// Lojas de Estado (Stores)
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore";

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

export default function AjustesScreen() {
  // GESTÃO DO TEMA
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo, setTema } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);

  // GESTÃO DA CONTA E FAMÍLIA
  const { usuario, familiaId, fazerLogout, sairDaFamilia } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGastoVida: 0,
    totalItensVida: 0,
    categoriaFavorita: "Nenhuma",
  });

  // Orçamentos Inteligentes
  const [orcamentos, setOrcamentos] = useState<Record<string, string>>({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarEstatisticasGlobais();
      carregarOrcamentos();
    }, []),
  );

  const mudarTema = (novoTema: "light" | "dark" | "system") => {
    Haptics.selectionAsync();
    setTema(novoTema);
  };

  const carregarOrcamentos = async () => {
    try {
      const salvos = await AsyncStorage.getItem("dehouse_orcamentos");
      if (salvos) setOrcamentos(JSON.parse(salvos));
    } catch (e) {}
  };

  const atualizarOrcamento = async (cat: string, valor: string) => {
    const novos = { ...orcamentos, [cat]: valor.replace(",", ".") };
    setOrcamentos(novos);
    setSalvandoOrcamento(true);
    await AsyncStorage.setItem("dehouse_orcamentos", JSON.stringify(novos));
    setTimeout(() => setSalvandoOrcamento(false), 500); // Efeito visual de salvamento
  };

  const carregarEstatisticasGlobais = async () => {
    setLoading(true);
    try {
      const result = await turso.execute(
        "SELECT preco_prateleira, categoria FROM compras_historico",
      );
      const compras = result.rows as any[];

      let total = 0;
      const cats: Record<string, number> = {};
      compras.forEach((item) => {
        total += Number(item.preco_prateleira) || 0;
        const c = String(item.categoria || "Outros");
        cats[c] = (cats[c] || 0) + 1;
      });

      let favorita = "Nenhuma";
      let maxItens = 0;
      for (const [key, value] of Object.entries(cats)) {
        if (value > maxItens) {
          maxItens = value;
          favorita = key;
        }
      }

      setStats({
        totalGastoVida: total,
        totalItensVida: compras.length,
        categoriaFavorita: favorita,
      });
    } catch (error) {
      console.log("Erro stats", error);
    } finally {
      setLoading(false);
    }
  };

  const exportarDados = async () => {
    Haptics.selectionAsync();
    try {
      const result = await turso.execute(
        "SELECT * FROM compras_historico ORDER BY id DESC LIMIT 100",
      );
      const compras = result.rows as any[];
      if (compras.length === 0) {
        Alert.alert("Vazio", "Você não tem compras.");
        return;
      }

      let csvString = "DADOS EXPORTADOS DO DEHOUSE\n\n";
      compras.forEach((c) => {
        csvString += `[${c.mes_referencia}] ${c.nome_produto} (${c.supermercado || "Mercado"}) - R$ ${Number(c.preco_prateleira).toFixed(2)}\n`;
      });
      await Share.share({ message: csvString, title: "Meus Dados Dehouse" });
    } catch (error) {
      Alert.alert("Erro", "Não foi possível exportar os dados.");
    }
  };

  const resetarBancoDeDados = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Zerar Aplicativo",
      "Isso apagará TODO o seu histórico e o saldo. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Zerar Tudo",
          style: "destructive",
          onPress: async () => {
            try {
              await turso.execute("DELETE FROM compras_historico");
              await turso.execute("UPDATE carteira SET saldo = 0 WHERE id = 1");
              await AsyncStorage.removeItem("dehouse_checklist");
              await AsyncStorage.removeItem("compras_offline");
              await AsyncStorage.removeItem("dehouse_orcamentos");
              setOrcamentos({});
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              Alert.alert("Sucesso", "O aplicativo foi resetado de fábrica.");
              carregarEstatisticasGlobais();
            } catch (error) {
              Alert.alert("Erro", "Falha ao zerar.");
            }
          },
        },
      ],
    );
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.tint} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.tituloTela}>Ajustes & Orçamento</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollPadding}
        >
          {/* PERFIL E FAMÍLIA */}
          <View style={styles.perfilCard}>
            <Image source={{ uri: usuario?.foto }} style={styles.fotoPerfil} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nomeUsuario}>{usuario?.nome}</Text>
              <Text style={styles.emailUsuario}>{usuario?.email}</Text>
            </View>
          </View>

          <View style={styles.cardInfo}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="home" size={24} color={color.tint} />
              <Text style={styles.tituloSecao}>
                Código da Família:{" "}
                <Text style={{ fontWeight: "900" }}>{familiaId}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.btnDangerOutline}
              onPress={() => {
                Alert.alert(
                  "Sair da Família",
                  "Tem a certeza que deseja sair?",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Sair",
                      style: "destructive",
                      onPress: sairDaFamilia,
                    },
                  ],
                );
              }}
            >
              <Text style={styles.textDanger}>Sair desta Família</Text>
            </TouchableOpacity>
          </View>

          {/* TEMA DO APLICATIVO */}
          <Text style={styles.labelGrupo}>APARÊNCIA DO APP</Text>
          <View style={styles.themeContainer}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                temaAtivo === "light" && styles.themeBtnActive,
              ]}
              onPress={() => mudarTema("light")}
            >
              <Ionicons
                name="sunny"
                size={24}
                color={temaAtivo === "light" ? color.tint : color.textSecondary}
              />
              <Text
                style={[
                  styles.themeText,
                  temaAtivo === "light" && styles.themeTextActive,
                ]}
              >
                Claro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeBtn,
                temaAtivo === "dark" && styles.themeBtnActive,
              ]}
              onPress={() => mudarTema("dark")}
            >
              <Ionicons
                name="moon"
                size={24}
                color={temaAtivo === "dark" ? color.tint : color.textSecondary}
              />
              <Text
                style={[
                  styles.themeText,
                  temaAtivo === "dark" && styles.themeTextActive,
                ]}
              >
                Escuro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeBtn,
                temaAtivo === "system" && styles.themeBtnActive,
              ]}
              onPress={() => mudarTema("system")}
            >
              <Ionicons
                name="phone-portrait"
                size={24}
                color={
                  temaAtivo === "system" ? color.tint : color.textSecondary
                }
              />
              <Text
                style={[
                  styles.themeText,
                  temaAtivo === "system" && styles.themeTextActive,
                ]}
              >
                Sistema
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEÇÃO DE ORÇAMENTO (LIMITES) */}
          <Text style={styles.labelGrupo}>CONTROLE DE ORÇAMENTO</Text>
          <View style={styles.cardEstatistica}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="pie-chart" size={24} color={color.tint} />
                <Text style={styles.tituloSecao}>Limites por Categoria</Text>
              </View>
              {salvandoOrcamento && (
                <ActivityIndicator size="small" color={color.tint} />
              )}
            </View>

            <Text
              style={{
                color: color.textSecondary,
                fontSize: 13,
                marginBottom: 16,
                lineHeight: 18,
              }}
            >
              Defina um limite de gastos para cada corredor. O app te avisará se
              o seu carrinho ultrapassar esses valores.
            </Text>

            {CATEGORIAS.map((cat) => (
              <View key={cat} style={styles.linhaOrcamento}>
                <Text style={styles.textoCatOrcamento}>{cat}</Text>
                <View style={styles.inputContainerOrcamento}>
                  <Text style={{ color: color.textSecondary, marginRight: 4 }}>
                    R$
                  </Text>
                  <TextInput
                    style={styles.inputOrcamento}
                    keyboardType="numeric"
                    placeholder="0,00"
                    placeholderTextColor={color.borderDark}
                    value={orcamentos[cat] || ""}
                    onChangeText={(val) => atualizarOrcamento(cat, val)}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* DADOS VITAIS */}
          <Text style={styles.labelGrupo}>ESTATÍSTICAS VITAIS</Text>
          <View style={styles.cardEstatistica}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Ionicons name="stats-chart" size={24} color="#FFC857" />
              <Text style={styles.tituloSecao}>Seu Histórico Vitalício</Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Dinheiro Movimentado:</Text>
              <Text style={[styles.valorEstatistica, { color: color.tint }]}>
                R$ {stats.totalGastoVida.toFixed(2)}
              </Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Produtos Comprados:</Text>
              <Text style={styles.valorEstatistica}>
                {stats.totalItensVida} itens
              </Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Seção favorita:</Text>
              <Text style={styles.valorEstatistica}>
                {stats.categoriaFavorita}
              </Text>
            </View>
          </View>

          <Text style={styles.labelGrupo}>DADOS E PRIVACIDADE</Text>
          <TouchableOpacity style={styles.btnAcao} onPress={exportarDados}>
            <View style={styles.btnAcaoLadoEsq}>
              <Ionicons name="download-outline" size={22} color={color.info} />
              <Text style={styles.textoBtnAcao}>Exportar Compras (CSV)</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={color.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnAcaoDanger}
            onPress={resetarBancoDeDados}
          >
            <View style={styles.btnAcaoLadoEsq}>
              <Ionicons name="warning-outline" size={22} color={color.danger} />
              <Text style={styles.textoBtnDanger}>Zerar Banco de Dados</Text>
            </View>
          </TouchableOpacity>

          {/* LOGOUT */}
          <TouchableOpacity
            style={styles.btnLogout}
            onPress={() => {
              Alert.alert(
                "Terminar Sessão",
                "Deseja realmente sair da sua conta?",
                [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Sair", style: "destructive", onPress: fazerLogout },
                ],
              );
            }}
          >
            <Ionicons name="log-out" size={24} color="white" />
            <Text
              style={{
                color: "white",
                fontWeight: "bold",
                marginLeft: 10,
                fontSize: 16,
              }}
            >
              Terminar Sessão
            </Text>
          </TouchableOpacity>

          <View style={styles.footerApp}>
            <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>
              Dehouse App
            </Text>
            <Text
              style={{ color: color.borderDark, fontSize: 12, marginTop: 4 }}
            >
              Versão 1.0.0 • Inteligência Local
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { padding: 20, paddingTop: 10, paddingBottom: 20 },
    tituloTela: { fontSize: 28, fontWeight: "bold", color: c.text },
    scrollPadding: { paddingHorizontal: 16, paddingBottom: 40 },

    // Perfil e Família
    perfilCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      padding: 20,
      borderRadius: 20,
      marginBottom: 15,
      elevation: 1,
      borderWidth: 1,
      borderColor: c.border,
    },
    fotoPerfil: {
      width: 56,
      height: 56,
      borderRadius: 28,
      marginRight: 15,
      backgroundColor: c.border,
    },
    nomeUsuario: { fontSize: 18, fontWeight: "bold", color: c.text },
    emailUsuario: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    cardInfo: {
      backgroundColor: c.card,
      padding: 20,
      borderRadius: 20,
      marginBottom: 30,
      elevation: 1,
      borderWidth: 1,
      borderColor: c.border,
    },
    btnDangerOutline: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.danger,
      alignItems: "center",
    },
    textDanger: { color: c.danger, fontWeight: "bold" },

    // Temas
    themeContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: c.card,
      padding: 8,
      borderRadius: 20,
      marginBottom: 30,
      elevation: 1,
      borderWidth: 1,
      borderColor: c.border,
    },
    themeBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 16,
    },
    themeBtnActive: { backgroundColor: c.border },
    themeText: {
      marginTop: 6,
      fontSize: 13,
      color: c.textSecondary,
      fontWeight: "600",
    },
    themeTextActive: { color: c.tint, fontWeight: "bold" },

    // Orçamentos e Estatísticas
    cardEstatistica: {
      backgroundColor: c.card,
      padding: 20,
      borderRadius: 20,
      elevation: 1,
      marginBottom: 30,
      borderWidth: 1,
      borderColor: c.border,
    },
    tituloSecao: {
      fontSize: 16,
      fontWeight: "bold",
      color: c.text,
      marginLeft: 10,
    },
    linhaOrcamento: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    textoCatOrcamento: { color: c.text, fontSize: 15, fontWeight: "600" },
    inputContainerOrcamento: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.background,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      width: 100,
    },
    inputOrcamento: {
      flex: 1,
      height: 40,
      color: c.text,
      fontWeight: "bold",
      textAlign: "right",
    },
    linhaEstatistica: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    labelEstatistica: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: "500",
    },
    valorEstatistica: { color: c.text, fontSize: 16, fontWeight: "bold" },

    // Botões de Ação
    labelGrupo: {
      fontSize: 12,
      fontWeight: "bold",
      color: c.textSecondary,
      marginLeft: 8,
      marginBottom: 10,
      letterSpacing: 1,
    },
    btnAcao: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    btnAcaoLadoEsq: { flexDirection: "row", alignItems: "center", gap: 12 },
    textoBtnAcao: { color: c.text, fontWeight: "600", fontSize: 15 },
    btnAcaoDanger: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.danger,
    },
    textoBtnDanger: { color: c.danger, fontWeight: "600", fontSize: 15 },

    btnLogout: {
      backgroundColor: c.danger,
      padding: 18,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
      marginTop: 10,
    },

    footerApp: { alignItems: "center", marginTop: 40, opacity: 0.5 },
  });
