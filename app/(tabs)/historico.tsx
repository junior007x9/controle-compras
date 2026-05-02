import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore"; // 🔥 IMPORTA O TEMA

export default function HistoricoScreen() {
  // 🔥 GESTÃO DE TEMA ATUALIZADA
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);

  const historicoGlobal = useCartStore((state) => state.historico);
  const sincronizarComNuvem = useCartStore(
    (state) => state.sincronizarComNuvem,
  );
  const familiaId = useAuthStore((state) => state.familiaId);

  const [loading, setLoading] = useState(false);
  const [mesOffset, setMesOffset] = useState(0);

  // 🔥 ESTADOS DO RECIBO DIGITAL
  const [reciboVisivel, setReciboVisivel] = useState(false);
  const [compraSelecionada, setCompraSelecionada] = useState<any>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const dataCalc = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d;
  }, [mesOffset]);

  const mesVisual = `${String(dataCalc.getMonth() + 1).padStart(2, "0")}/${dataCalc.getFullYear()}`;
  const mesQuery = `${String(dataCalc.getMonth() + 1).padStart(2, "0")}-${dataCalc.getFullYear()}`;

  const historicoMes = useMemo(() => {
    return historicoGlobal.filter(
      (item: any) => item.mes_referencia === mesQuery,
    );
  }, [historicoGlobal, mesQuery]);

  const { totalGastoMes, itemMaisCaro, resumoCategorias } = useMemo(() => {
    let total = 0;
    let maisCaro: any = null;
    const categorias: Record<string, number> = {};

    historicoMes.forEach((item) => {
      const preco = Number(item.preco_prateleira) || 0;
      total += preco;
      if (!maisCaro || preco > Number(maisCaro.preco_prateleira))
        maisCaro = item;
      const cat = String(item.categoria || "Outros");
      if (categorias[cat]) categorias[cat] += preco;
      else categorias[cat] = preco;
    });

    return {
      totalGastoMes: total,
      itemMaisCaro: maisCaro,
      resumoCategorias: categorias,
    };
  }, [historicoMes]);

  const navegarMes = (direcao: number) => {
    Haptics.selectionAsync();
    setMesOffset((prev) => prev + direcao);
  };

  useFocusEffect(
    useCallback(() => {
      sincronizarComNuvem();
    }, []),
  );

  const apagarHistoricoDoMes = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Atenção",
      "Tem certeza que deseja apagar todos os recibos deste mês?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await turso.execute({
                sql: "DELETE FROM compras_historico WHERE mes_referencia = ? AND familia_id = ?",
                args: [mesQuery, familiaId],
              });
              await sincronizarComNuvem();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (error) {
              Alert.alert(
                "Sem Internet",
                "Você precisa de conexão para apagar o histórico.",
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const refazerCompra = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const listaSalva = await AsyncStorage.getItem("dehouse_checklist");
      let checklistAtual = listaSalva ? JSON.parse(listaSalva) : [];
      const itensUnicos: any[] = [];
      const nomesVistos = new Set();

      historicoMes.forEach((item: any) => {
        if (!nomesVistos.has(item.nome_produto)) {
          nomesVistos.add(item.nome_produto);
          itensUnicos.push({
            id: Date.now().toString() + Math.random().toString(),
            nome: item.nome_produto,
            categoria: item.categoria,
            comprado: false,
          });
        }
      });

      const novaLista = [...itensUnicos, ...checklistAtual];
      await AsyncStorage.setItem(
        "dehouse_checklist",
        JSON.stringify(novaLista),
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Pronto!",
        `${itensUnicos.length} itens foram enviados para a sua aba de Planejamento (Lista).`,
      );
    } catch (e) {
      Alert.alert("Erro", "Não foi possível copiar os itens.");
    }
  };

  const abrirRecibo = (compra: any) => {
    Haptics.selectionAsync();
    setCompraSelecionada(compra);
    setReciboVisivel(true);
  };

  const renderGraficoCategorias = () => {
    const chaves = Object.keys(resumoCategorias).sort(
      (a, b) => resumoCategorias[b] - resumoCategorias[a],
    );
    if (chaves.length === 0) return null;
    const coresCat: Record<string, string> = {
      Alimentação: "#FF7A00",
      Limpeza: "#4DA8FF",
      Higiene: "#2ED1B2",
      Bebidas: "#9B51E0",
      Outros: color.textSecondary,
    };

    return (
      <View style={styles.cardGrafico}>
        <Text style={styles.tituloGrafico}>Análise de Gastos</Text>
        {chaves.map((cat) => {
          const valor = resumoCategorias[cat];
          const porcentagem =
            totalGastoMes > 0 ? (valor / totalGastoMes) * 100 : 0;
          const corCat = coresCat[cat] || coresCat["Outros"];

          return (
            <View key={cat} style={styles.linhaGrafico}>
              <View style={styles.infoGrafico}>
                <Text style={styles.textoCat}>{cat}</Text>
                <Text style={styles.textoValorCat}>
                  R$ {valor.toFixed(2)}{" "}
                  <Text style={{ fontSize: 10, color: color.textSecondary }}>
                    ({porcentagem.toFixed(0)}%)
                  </Text>
                </Text>
              </View>
              <View style={styles.barraFundoGrafico}>
                <View
                  style={[
                    styles.barraPreenchidaGrafico,
                    { width: `${porcentagem}%`, backgroundColor: corCat },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderInsights = () => {
    if (!itemMaisCaro || historicoMes.length === 0) return null;
    const mediaItem = totalGastoMes / historicoMes.length;

    return (
      <View style={styles.cardInsight}>
        <View style={styles.insightHeader}>
          <Ionicons name="bulb" size={20} color="#FFC857" />
          <Text style={styles.insightTitulo}>Inteligência Financeira</Text>
        </View>
        <View style={styles.insightLinha}>
          <Text style={styles.insightLabel}>Produto mais caro:</Text>
          <Text style={styles.insightValor} numberOfLines={1}>
            {itemMaisCaro.nome_produto} (R${" "}
            {Number(itemMaisCaro.preco_prateleira).toFixed(2)})
          </Text>
        </View>
        <View style={styles.insightLinha}>
          <Text style={styles.insightLabel}>Ticket médio por item:</Text>
          <Text style={styles.insightValor}>R$ {mediaItem.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  // 🔥 RENDERIZAÇÃO DO ITEM ATUALIZADA PARA SER CLICÁVEL E MOSTRAR ÍCONE DE FOTO
  const renderItemHistorico = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.itemCompra}
      onPress={() => abrirRecibo(item)}
    >
      <View style={styles.itemIcone}>
        <Ionicons
          name="receipt-outline"
          size={20}
          color={color.textSecondary}
        />
      </View>
      <View style={styles.itemDetalhes}>
        <Text style={styles.itemNome}>{item.nome_produto}</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.itemCategoria}>
            {item.categoria} {item.supermercado ? `• ${item.supermercado}` : ""}
          </Text>
          {(item.foto_comprovante || item.foto_etiqueta) && (
            <Ionicons
              name="images"
              size={14}
              color={color.tint}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
      </View>
      <View style={styles.itemPrecoContainer}>
        <Text style={styles.itemPreco}>
          R$ {Number(item.preco_prateleira).toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tituloTela}>Histórico</Text>
        <View style={styles.seletorMes}>
          <TouchableOpacity
            onPress={() => navegarMes(-1)}
            style={styles.btnNav}
          >
            <Ionicons name="chevron-back" size={20} color={color.text} />
          </TouchableOpacity>
          <Text style={styles.subtituloTela}>
            {mesOffset === 0 ? "Mês Atual" : mesVisual}
          </Text>
          <TouchableOpacity
            onPress={() => navegarMes(1)}
            style={styles.btnNav}
            disabled={mesOffset >= 0}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={mesOffset >= 0 ? color.border : color.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={color.tint} />
        </View>
      ) : (
        <FlatList
          data={historicoMes}
          keyExtractor={(item, index) =>
            item.id ? String(item.id) : String(index)
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listaContainer}
          ListHeaderComponent={() => (
            <View>
              <View style={styles.cardTotal}>
                <View style={styles.cardHeaderTotal}>
                  <Ionicons
                    name="wallet-outline"
                    size={20}
                    color={color.textSecondary}
                  />
                  <Text style={styles.labelTotal}>GASTO TOTAL DO MÊS</Text>
                </View>
                <Text style={styles.valorTotal}>
                  R$ {totalGastoMes.toFixed(2)}
                </Text>
              </View>

              {renderInsights()}
              {renderGraficoCategorias()}

              <View style={styles.headerListaRecibos}>
                <Text style={styles.tituloSecao}>
                  Recibos ({historicoMes.length})
                </Text>

                {historicoMes.length > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <TouchableOpacity
                      onPress={refazerCompra}
                      style={styles.btnRefazer}
                    >
                      <Ionicons name="refresh" size={16} color="white" />
                      <Text
                        style={{
                          color: "white",
                          fontWeight: "bold",
                          fontSize: 12,
                        }}
                      >
                        Refazer Compra
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={apagarHistoricoDoMes}>
                      <Ionicons
                        name="trash-outline"
                        size={22}
                        color={color.danger}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
          renderItem={renderItemHistorico}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons
                name="folder-open-outline"
                size={60}
                color={color.borderDark}
              />
              <Text style={styles.textoVazio}>Nenhum registro encontrado.</Text>
              <Text style={styles.subtextoVazio}>
                As compras finalizadas aparecerão aqui.
              </Text>
            </View>
          )}
        />
      )}

      {/* 🔥 MODAL DO RECIBO DIGITAL */}
      <Modal
        visible={reciboVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setReciboVisivel(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reciboPapel}>
            <View style={styles.reciboHeader}>
              <Ionicons
                name="checkmark-circle"
                size={40}
                color="#2ED1B2"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.reciboTitulo}>Comprovante Dehouse</Text>
              <Text style={styles.reciboMercado}>
                {compraSelecionada?.supermercado || "Mercado"}
              </Text>
            </View>

            <View style={styles.reciboDivisor} />

            <View style={styles.reciboRow}>
              <Text style={styles.reciboLabel}>Produto:</Text>
              <Text style={styles.reciboValor}>
                {compraSelecionada?.nome_produto}
              </Text>
            </View>
            <View style={styles.reciboRow}>
              <Text style={styles.reciboLabel}>Categoria:</Text>
              <Text style={styles.reciboValor}>
                {compraSelecionada?.categoria}
              </Text>
            </View>
            <View style={styles.reciboRow}>
              <Text style={styles.reciboLabel}>Código:</Text>
              <Text style={styles.reciboValor}>
                {compraSelecionada?.codigo_barras || "Sem código"}
              </Text>
            </View>
            <View style={styles.reciboRow}>
              <Text style={styles.reciboLabel}>Mês Fiscal:</Text>
              <Text style={styles.reciboValor}>
                {compraSelecionada?.mes_referencia}
              </Text>
            </View>

            <View style={styles.reciboDivisor} />

            <View style={styles.reciboRowTotal}>
              <Text style={styles.reciboTotalLabel}>VALOR PAGO</Text>
              <Text style={styles.reciboTotalValor}>
                R$ {Number(compraSelecionada?.preco_prateleira || 0).toFixed(2)}
              </Text>
            </View>

            {/* SE HOUVER FOTOS (PRODUTO OU ETIQUETA) */}
            {(compraSelecionada?.foto_comprovante ||
              compraSelecionada?.foto_etiqueta) && (
              <View style={styles.fotosContainer}>
                <Text style={styles.reciboLabelAnexos}>
                  ANEXOS FOTOGRÁFICOS
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {compraSelecionada?.foto_comprovante && (
                    <TouchableOpacity
                      onPress={() =>
                        setFotoAmpliada(compraSelecionada.foto_comprovante)
                      }
                    >
                      <Image
                        source={{ uri: compraSelecionada.foto_comprovante }}
                        style={styles.fotoRecibo}
                      />
                    </TouchableOpacity>
                  )}
                  {compraSelecionada?.foto_etiqueta && (
                    <TouchableOpacity
                      onPress={() =>
                        setFotoAmpliada(compraSelecionada.foto_etiqueta)
                      }
                    >
                      <Image
                        source={{ uri: compraSelecionada.foto_etiqueta }}
                        style={styles.fotoRecibo}
                      />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              style={styles.btnFecharRecibo}
              onPress={() => setReciboVisivel(false)}
            >
              <Text style={styles.btnFecharTexto}>Fechar Recibo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🔥 MODAL PARA AMPLIAR A FOTO DO RECIBO */}
      <Modal
        visible={fotoAmpliada !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFotoAmpliada(null)}
      >
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity
            style={styles.btnFecharImagem}
            onPress={() => setFotoAmpliada(null)}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          {fotoAmpliada && (
            <Image
              source={{ uri: fotoAmpliada }}
              style={styles.fullScreenImage}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 20,
      paddingTop: 10,
    },
    tituloTela: { fontSize: 28, fontWeight: "bold", color: c.text },
    seletorMes: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.card,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    btnNav: { padding: 4 },
    subtituloTela: {
      fontSize: 13,
      color: c.text,
      fontWeight: "bold",
      marginHorizontal: 8,
      minWidth: 70,
      textAlign: "center",
    },

    listaContainer: { paddingHorizontal: 16, paddingBottom: 40 },
    cardTotal: {
      backgroundColor: c.card,
      padding: 20,
      borderRadius: 20,
      elevation: 2,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardHeaderTotal: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    labelTotal: {
      fontSize: 12,
      fontWeight: "bold",
      color: c.textSecondary,
      marginLeft: 8,
      letterSpacing: 0.5,
    },
    valorTotal: {
      fontSize: 36,
      fontWeight: "900",
      color: c.danger,
      letterSpacing: -1,
    },

    cardInsight: {
      backgroundColor: c.background,
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: "#FFC857",
      borderStyle: "dashed",
    },
    insightHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    insightTitulo: {
      color: c.text,
      fontWeight: "bold",
      marginLeft: 6,
      fontSize: 14,
    },
    insightLinha: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
      alignItems: "center",
    },
    insightLabel: { color: c.textSecondary, fontSize: 12 },
    insightValor: {
      color: c.text,
      fontWeight: "bold",
      fontSize: 13,
      flex: 1,
      textAlign: "right",
      marginLeft: 10,
    },

    cardGrafico: {
      backgroundColor: c.card,
      padding: 20,
      borderRadius: 20,
      elevation: 2,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: c.border,
    },
    tituloGrafico: {
      fontSize: 16,
      fontWeight: "bold",
      color: c.text,
      marginBottom: 16,
    },
    linhaGrafico: { marginBottom: 12 },
    infoGrafico: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    textoCat: { fontSize: 13, fontWeight: "600", color: c.text },
    textoValorCat: { fontSize: 13, fontWeight: "bold", color: c.textSecondary },
    barraFundoGrafico: {
      height: 6,
      backgroundColor: c.border,
      borderRadius: 3,
      overflow: "hidden",
    },
    barraPreenchidaGrafico: { height: "100%", borderRadius: 3 },

    headerListaRecibos: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    tituloSecao: { fontSize: 18, fontWeight: "bold", color: c.text },
    btnRefazer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.info,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      gap: 4,
    },

    itemCompra: {
      flexDirection: "row",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    itemIcone: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: c.background,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    itemDetalhes: { flex: 1 },
    itemNome: {
      fontSize: 15,
      fontWeight: "bold",
      color: c.text,
      marginBottom: 4,
    },
    itemCategoria: { fontSize: 12, color: c.tint, fontWeight: "600" },
    itemPrecoContainer: { alignItems: "flex-end" },
    itemPreco: { fontSize: 16, fontWeight: "800", color: c.text },

    emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
    textoVazio: {
      color: c.text,
      fontSize: 16,
      fontWeight: "bold",
      marginTop: 12,
      textAlign: "center",
    },
    subtextoVazio: {
      color: c.textSecondary,
      fontSize: 14,
      marginTop: 6,
      textAlign: "center",
    },

    // ESTILOS DO RECIBO
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 20,
    },
    reciboPapel: {
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 24,
      elevation: 10,
    },
    reciboHeader: { alignItems: "center", marginBottom: 20 },
    reciboTitulo: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#1E1E1E",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    reciboMercado: { fontSize: 14, color: "#666", marginTop: 4 },
    reciboDivisor: {
      height: 1,
      width: "100%",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderStyle: "dashed",
      marginVertical: 16,
    },
    reciboRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    reciboLabel: { fontSize: 14, color: "#666" },
    reciboValor: {
      fontSize: 14,
      fontWeight: "600",
      color: "#1E1E1E",
      maxWidth: "60%",
      textAlign: "right",
    },
    reciboRowTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginVertical: 10,
    },
    reciboTotalLabel: { fontSize: 16, fontWeight: "bold", color: "#1E1E1E" },
    reciboTotalValor: { fontSize: 24, fontWeight: "900", color: "#1E1E1E" },
    fotosContainer: {
      marginTop: 20,
      backgroundColor: "#F3F4F6",
      padding: 16,
      borderRadius: 12,
    },
    reciboLabelAnexos: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#666",
      marginBottom: 10,
    },
    fotoRecibo: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 10,
      borderWidth: 1,
      borderColor: "#D1D5DB",
    },
    btnFecharRecibo: {
      backgroundColor: "#1E1E1E",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 24,
    },
    btnFecharTexto: { color: "#FFFFFF", fontWeight: "bold", fontSize: 16 },

    fullScreenImageContainer: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.9)",
      justifyContent: "center",
      alignItems: "center",
    },
    btnFecharImagem: {
      position: "absolute",
      top: 50,
      right: 20,
      zIndex: 10,
      padding: 10,
    },
    fullScreenImage: { width: "100%", height: "80%", resizeMode: "contain" },
  });
