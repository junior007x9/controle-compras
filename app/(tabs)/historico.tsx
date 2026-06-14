import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image"; 

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore";

const SkeletonItem = ({ color }: { color: any }) => {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={{ flexDirection: "row", backgroundColor: color.card, padding: 16, borderRadius: 16, marginBottom: 10, alignItems: "center", borderWidth: 1, borderColor: color.border }}>
      <Animated.View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: color.border, opacity: fadeAnim, marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Animated.View style={{ width: '70%', height: 16, borderRadius: 4, backgroundColor: color.border, opacity: fadeAnim, marginBottom: 8 }} />
        <Animated.View style={{ width: '40%', height: 12, borderRadius: 4, backgroundColor: color.border, opacity: fadeAnim }} />
      </View>
      <Animated.View style={{ width: '20%', height: 20, borderRadius: 4, backgroundColor: color.border, opacity: fadeAnim }} />
    </View>
  );
};

export default function HistoricoScreen() {
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);
  const router = useRouter();

  const historicoGlobal = useCartStore((state) => state.historico);
  const sincronizarComNuvem = useCartStore((state) => state.sincronizarComNuvem);
  const familiaId = useAuthStore((state) => state.familiaId);
  const usuario = useAuthStore((state) => state.usuario);

  // 🔥 REDIRECIONAMENTO AUTOMÁTICO SE SAIR DA FAMÍLIA
  useEffect(() => {
    if (!usuario || !familiaId) {
      router.replace("/");
    }
  }, [usuario, familiaId]);

  const [loading, setLoading] = useState(true);
  const [mesOffset, setMesOffset] = useState(0);
  const [busca, setBusca] = useState("");
  const [reciboVisivel, setReciboVisivel] = useState(false);
  const [compraSelecionada, setCompraSelecionada] = useState<any>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [analiseLocal, setAnaliseLocal] = useState<{ insight: string; dica: string } | null>(null);

  const dataCalc = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d;
  }, [mesOffset]);

  const mesVisual = `${String(dataCalc.getMonth() + 1).padStart(2, "0")}/${dataCalc.getFullYear()}`;
  const mesQuery = `${String(dataCalc.getMonth() + 1).padStart(2, "0")}-${dataCalc.getFullYear()}`;

  const historicoAgrupado = useMemo(() => {
    const doMes = historicoGlobal.filter((i: any) => i.mes_referencia === mesQuery && i.familia_id === familiaId);
    
    const grupos: Record<string, any> = {};

    doMes.forEach((item: any) => {
      const chave = `${item.supermercado || "Desconhecido"}_${item.data_compra || "manual"}`;
      
      let precoNum = Number(item.preco_prateleira) || 0;
      if (precoNum > 99999) precoNum = 0; 

      if (!grupos[chave]) {
        grupos[chave] = {
          id: chave,
          mercado: item.supermercado || "Supermercado",
          data: item.data_compra,
          mes_referencia: item.mes_referencia,
          total: precoNum,
          itens: [item],
          foto_comprovante: item.foto_comprovante || null,
          foto_etiqueta: item.foto_etiqueta || null
        };
      } else {
        grupos[chave].total += precoNum;
        grupos[chave].itens.push(item);
        if(item.foto_comprovante) grupos[chave].foto_comprovante = item.foto_comprovante;
      }
    });

    return Object.values(grupos).sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [historicoGlobal, mesQuery, familiaId]);

  const historicoFiltrado = useMemo(() => {
    if (!busca.trim()) return historicoAgrupado;
    const textoBusca = busca.toLowerCase();
    return historicoAgrupado.filter((grupo: any) => 
      grupo.mercado.toLowerCase().includes(textoBusca) || 
      grupo.itens.some((i: any) => i.nome_produto && i.nome_produto.toLowerCase().includes(textoBusca))
    );
  }, [historicoAgrupado, busca]);

  const { totalGastoMes, itemMaisCaro, resumoCategorias } = useMemo(() => {
    let total = 0;
    let maisCaro: any = null;
    const categorias: Record<string, number> = {};

    historicoAgrupado.forEach((grupo: any) => {
      total += grupo.total;
      
      grupo.itens.forEach((item: any) => {
         let p = Number(item.preco_prateleira) || 0;
         if (p > 0 && (!maisCaro || p > Number(maisCaro.preco_prateleira))) {
            maisCaro = item;
         }
         const cat = String(item.categoria || "Outros");
         if (categorias[cat]) categorias[cat] += p;
         else categorias[cat] = p;
      });
    });

    return { totalGastoMes: total, itemMaisCaro: maisCaro, resumoCategorias: categorias };
  }, [historicoAgrupado]);

  const navegarMes = (direcao: number) => {
    Haptics.selectionAsync();
    setMesOffset((prev) => prev + direcao);
    setAnaliseLocal(null);
    setBusca(""); 
  };

  const carregarDadosSimulados = async () => {
    setLoading(true);
    await sincronizarComNuvem();
    setTimeout(() => setLoading(false), 800);
  };

  useFocusEffect(
    useCallback(() => {
      carregarDadosSimulados();
    }, [sincronizarComNuvem]),
  );

  const gerarConsultoriaLocal = () => {
    Haptics.selectionAsync();
    if (historicoAgrupado.length === 0) return;

    let novaAnalise = { insight: "", dica: "" };
    const chaves = Object.keys(resumoCategorias).sort((a, b) => resumoCategorias[b] - resumoCategorias[a]);
    const catMaisCara = chaves[0];
    const valorCatMaisCara = resumoCategorias[catMaisCara];
    const porcentagemCat = totalGastoMes > 0 ? (valorCatMaisCara / totalGastoMes) * 100 : 0;
    const porcentagemItemCaro = (itemMaisCaro && totalGastoMes > 0) ? (Number(itemMaisCaro.preco_prateleira) / totalGastoMes) * 100 : 0;

    if (porcentagemItemCaro > 30) {
      novaAnalise.insight = `Alerta: O item '${itemMaisCaro.nome_produto}' consumiu ${porcentagemItemCaro.toFixed(0)}% do seu orçamento mensal!`;
      novaAnalise.dica = "Dica: Tente pesquisar esse produto em outros supermercados ou considere alternativas.";
    } else if (catMaisCara === "Bebidas" && porcentagemCat > 15) {
      novaAnalise.insight = `Você gastou uma fatia grande (${porcentagemCat.toFixed(0)}%) apenas em Bebidas.`;
      novaAnalise.dica = "Dica: Reduzir a compra de sucos prontos ou bebidas alcoólicas gera economia rápida.";
    } else if (catMaisCara === "Outros" && porcentagemCat > 20) {
      novaAnalise.insight = `Cuidado! ${porcentagemCat.toFixed(0)}% dos seus gastos foram em itens não categorizados.`;
      novaAnalise.dica = "Dica: Tente classificar melhor os seus produtos para ter um controle mais preciso.";
    } else if (catMaisCara === "Alimentação") {
      novaAnalise.insight = `A sua base é a Alimentação, representando ${porcentagemCat.toFixed(0)}% do orçamento.`;
      novaAnalise.dica = "Dica: Fique atento aos dias de promoção (como a Terça Verde) para otimizar gastos.";
    } else {
      novaAnalise.insight = `A categoria mais pesada este mês foi ${catMaisCara} (${porcentagemCat.toFixed(0)}%).`;
      novaAnalise.dica = `Dica: Analise se não está a estocar demasiados itens de ${catMaisCara} em casa sem necessidade.`;
    }

    setAnaliseLocal(novaAnalise);
  };

  const apagarHistoricoDoMes = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Atenção", "Tem certeza que deseja apagar todos os recibos deste mês?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: async () => {
          setLoading(true);
          try {
            await turso.execute({ sql: "DELETE FROM compras_historico WHERE mes_referencia = ? AND familia_id = ?", args: [mesQuery, familiaId || ""] });
            await sincronizarComNuvem();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) { Alert.alert("Erro", "Falha na conexão."); } finally { setLoading(false); }
        }
      }
    ]);
  };

  const refazerCompra = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const listaSalva = await AsyncStorage.getItem(`dehouse_checklist_${familiaId}`);
      let checklistAtual = listaSalva ? JSON.parse(listaSalva) : [];
      const itensUnicos: any[] = [];
      const nomesVistos = new Set();

      historicoAgrupado.forEach((grupo: any) => {
        grupo.itens.forEach((item: any) => {
           if (item.nome_produto && !nomesVistos.has(item.nome_produto)) {
             nomesVistos.add(item.nome_produto);
             itensUnicos.push({ id: Date.now().toString() + Math.random().toString(), nome: item.nome_produto, categoria: item.categoria, comprado: false });
           }
        });
      });

      const novaLista = [...itensUnicos, ...checklistAtual];
      await AsyncStorage.setItem(`dehouse_checklist_${familiaId}`, JSON.stringify(novaLista));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Pronto!", `${itensUnicos.length} produtos foram enviados para o Planejamento.`);
    } catch (e) { Alert.alert("Erro", "Não foi possível copiar os itens."); }
  };

  const abrirRecibo = (grupo: any) => {
    Haptics.selectionAsync();
    setCompraSelecionada(grupo);
    setReciboVisivel(true);
  };

  const renderGraficoCategorias = () => {
    const chaves = Object.keys(resumoCategorias).sort((a, b) => resumoCategorias[b] - resumoCategorias[a]);
    if (chaves.length === 0) return null;
    const coresCat: Record<string, string> = { Alimentação: "#FF7A00", Limpeza: "#4DA8FF", Higiene: "#2ED1B2", Bebidas: "#9B51E0", Outros: color.textSecondary };

    return (
      <View style={styles.cardGrafico}>
        <Text style={styles.tituloGrafico}>Análise de Gastos</Text>
        {chaves.map((cat) => {
          const valor = resumoCategorias[cat];
          const porcentagem = totalGastoMes > 0 ? (valor / totalGastoMes) * 100 : 0;
          return (
            <View key={cat} style={styles.linhaGrafico}>
              <View style={styles.infoGrafico}>
                <Text style={styles.textoCat}>{cat}</Text>
                <Text style={styles.textoValorCat}>R$ {valor.toFixed(2)} <Text style={{ fontSize: 10, color: color.textSecondary }}>({porcentagem.toFixed(0)}%)</Text></Text>
              </View>
              <View style={styles.barraFundoGrafico}>
                <View style={[styles.barraPreenchidaGrafico, { width: `${porcentagem}%`, backgroundColor: coresCat[cat] || coresCat["Outros"] }]} />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderInsights = () => {
    if (!itemMaisCaro || historicoAgrupado.length === 0) return null;
    const mediaItem = totalGastoMes / (historicoAgrupado.reduce((acc, g) => acc + g.itens.length, 0));

    return (
      <View style={styles.cardInsight}>
        <View style={styles.insightHeader}>
          <Ionicons name="bulb" size={20} color="#FFC857" />
          <Text style={styles.insightTitulo}>Resumo Factual do Mês</Text>
        </View>
        <View style={styles.insightLinha}>
          <Text style={styles.insightLabel}>Produto mais caro:</Text>
          <Text style={styles.insightValor} numberOfLines={1}>{itemMaisCaro.nome_produto} (R$ {Number(itemMaisCaro.preco_prateleira).toFixed(2)})</Text>
        </View>
        <View style={styles.insightLinha}>
          <Text style={styles.insightLabel}>Ticket médio por item:</Text>
          <Text style={styles.insightValor}>R$ {mediaItem.toFixed(2)}</Text>
        </View>
      </View>
    );
  };

  const renderItemHistorico = ({ item: grupo }: { item: any }) => {
    const qtdItens = grupo.itens.length;
    const dataCompra = grupo.data ? new Date(grupo.data).toLocaleDateString('pt-BR') : "Data desconhecida";

    return (
      <TouchableOpacity style={styles.itemCompra} onPress={() => abrirRecibo(grupo)}>
        <View style={styles.itemIcone}><Ionicons name="receipt-outline" size={20} color={color.textSecondary} /></View>
        <View style={styles.itemDetalhes}>
          <Text style={styles.itemNome} numberOfLines={1}>{grupo.mercado}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.itemCategoria} numberOfLines={1}>
              {qtdItens} produto{qtdItens > 1 ? 's' : ''} • {dataCompra}
            </Text>
            {(grupo.foto_comprovante || grupo.foto_etiqueta) && <Ionicons name="images" size={14} color={color.tint} style={{ marginLeft: 6 }} />}
          </View>
        </View>
        <View style={styles.itemPrecoContainer}>
          <Text style={styles.itemPreco}>R$ {grupo.total.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.tituloTela}>Histórico</Text>
        <View style={styles.seletorMes}>
          <TouchableOpacity onPress={() => navegarMes(-1)} style={styles.btnNav}><Ionicons name="chevron-back" size={20} color={color.text} /></TouchableOpacity>
          <Text style={styles.subtituloTela}>{mesOffset === 0 ? "Mês Atual" : mesVisual}</Text>
          <TouchableOpacity onPress={() => navegarMes(1)} style={styles.btnNav} disabled={mesOffset >= 0}><Ionicons name="chevron-forward" size={20} color={mesOffset >= 0 ? color.border : color.text} /></TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: color.card, borderRadius: 16, paddingHorizontal: 12, borderWidth: 1, borderColor: busca ? color.tint : color.border }}>
          <Ionicons name="search" size={20} color={busca ? color.tint : color.textSecondary} />
          <TextInput style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: color.text, fontSize: 16 }} placeholder="Pesquisar produto, mercado..." placeholderTextColor={color.textSecondary} value={busca} onChangeText={setBusca} />
          {busca.length > 0 && <TouchableOpacity onPress={() => { setBusca(""); Keyboard.dismiss(); }}><Ionicons name="close-circle" size={20} color={color.textSecondary} /></TouchableOpacity>}
        </View>
      </View>

      {loading ? (
        <ScrollView style={styles.listaContainer} showsVerticalScrollIndicator={false}>
          <View style={[styles.cardTotal, { height: 100, justifyContent: 'center', backgroundColor: color.card }]}><ActivityIndicator color={color.tint} /></View>
          <SkeletonItem color={color} />
          <SkeletonItem color={color} />
          <SkeletonItem color={color} />
          <SkeletonItem color={color} />
        </ScrollView>
      ) : (
        <FlatList
          data={historicoFiltrado}
          keyExtractor={(item, index) => item.id ? String(item.id) : String(index)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listaContainer}
          ListHeaderComponent={() => (
            <View>
              <View style={styles.cardTotal}>
                <View style={styles.cardHeaderTotal}><Ionicons name="wallet-outline" size={20} color={color.textSecondary} /><Text style={styles.labelTotal}>GASTO TOTAL DO MÊS</Text></View>
                <Text style={styles.valorTotal}>R$ {totalGastoMes.toFixed(2)}</Text>
              </View>

              {renderInsights()}
              {renderGraficoCategorias()}

              {historicoAgrupado.length > 0 && (
                <View style={styles.cardIA}>
                  {!analiseLocal ? (
                    <TouchableOpacity style={styles.btnPedirIA} onPress={gerarConsultoriaLocal}>
                      <Ionicons name="hardware-chip" size={24} color="white" />
                      <Text style={styles.txtPedirIA}>Gerar Análise do Mês</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ padding: 15 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                        <Ionicons name="pulse" size={20} color="#10B981" />
                        <Text style={{ color: color.text, fontWeight: 'bold', marginLeft: 8 }}>Dehouse Analytics</Text>
                      </View>
                      <Text style={{ color: color.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>"{analiseLocal.insight}"</Text>
                      <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 20 }}>💡 {analiseLocal.dica}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.headerListaRecibos}>
                <Text style={styles.tituloSecao}>Notas Fiscais ({historicoFiltrado.length})</Text>
                {historicoAgrupado.length > 0 && (
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <TouchableOpacity onPress={refazerCompra} style={styles.btnRefazer}><Ionicons name="refresh" size={16} color="white" /><Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>Refazer Tudo</Text></TouchableOpacity>
                    <TouchableOpacity onPress={apagarHistoricoDoMes}><Ionicons name="trash-outline" size={22} color={color.danger} /></TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}
          renderItem={renderItemHistorico}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name={busca ? "search-outline" : "folder-open-outline"} size={60} color={color.borderDark} />
              <Text style={styles.textoVazio}>{busca ? "Nenhum resultado encontrado." : "Nenhum registro encontrado."}</Text>
              <Text style={styles.subtextoVazio}>{busca ? "Tente pesquisar por outro nome ou categoria." : "As compras finalizadas aparecerão aqui."}</Text>
            </View>
          )}
        />
      )}

      {/* MODAL DO RECIBO COM LISTA DE PRODUTOS */}
      <Modal visible={reciboVisivel} animationType="slide" transparent={true} onRequestClose={() => setReciboVisivel(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.reciboPapel, { padding: 0, maxHeight: '85%', overflow: 'hidden' }]}>
            
            <View style={{ padding: 24, paddingBottom: 15 }}>
                <View style={styles.reciboHeader}>
                <Ionicons name="checkmark-circle" size={40} color="#2ED1B2" style={{ marginBottom: 10 }} />
                <Text style={styles.reciboTitulo}>Comprovante</Text>
                <Text style={styles.reciboMercado} numberOfLines={1}>{compraSelecionada?.mercado}</Text>
                <Text style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    {compraSelecionada?.data ? new Date(compraSelecionada.data).toLocaleDateString('pt-BR') : ""}
                </Text>
                </View>
                <View style={styles.reciboDivisor} />
            </View>

            <ScrollView style={{ paddingHorizontal: 24, flexGrow: 0 }}>
                {compraSelecionada?.itens?.map((item: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", paddingBottom: 8 }}>
                        <Text style={{ flex: 1, fontSize: 14, color: "#1E1E1E", marginRight: 10 }} numberOfLines={2}>
                            {item.nome_produto}
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#1E1E1E" }}>
                            R$ {Number(item.preco_prateleira).toFixed(2)}
                        </Text>
                    </View>
                ))}
            </ScrollView>

            <View style={{ padding: 24, paddingTop: 15 }}>
                <View style={styles.reciboDivisor} />
                <View style={styles.reciboRowTotal}>
                <Text style={styles.reciboTotalLabel}>TOTAL</Text>
                <Text style={styles.reciboTotalValor}>
                    R$ {compraSelecionada?.total?.toFixed(2) || "0.00"}
                </Text>
                </View>

                {(compraSelecionada?.foto_comprovante || compraSelecionada?.foto_etiqueta) && (
                <View style={styles.fotosContainer}>
                    <Text style={styles.reciboLabelAnexos}>ANEXOS FOTOGRÁFICOS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {compraSelecionada?.foto_comprovante && (
                        <TouchableOpacity onPress={() => setFotoAmpliada(compraSelecionada.foto_comprovante)}>
                        <Image source={{ uri: compraSelecionada.foto_comprovante }} style={styles.fotoRecibo} contentFit="cover" transition={500} />
                        </TouchableOpacity>
                    )}
                    {compraSelecionada?.foto_etiqueta && (
                        <TouchableOpacity onPress={() => setFotoAmpliada(compraSelecionada.foto_etiqueta)}>
                        <Image source={{ uri: compraSelecionada.foto_etiqueta }} style={styles.fotoRecibo} contentFit="cover" transition={500} />
                        </TouchableOpacity>
                    )}
                    </ScrollView>
                </View>
                )}
                <TouchableOpacity style={styles.btnFecharRecibo} onPress={() => setReciboVisivel(false)}>
                <Text style={styles.btnFecharTexto}>Fechar Recibo</Text>
                </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      <Modal visible={fotoAmpliada !== null} transparent={true} animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <View style={styles.fullScreenImageContainer}>
          <TouchableOpacity style={styles.btnFecharImagem} onPress={() => setFotoAmpliada(null)}><Ionicons name="close-circle" size={40} color="white" /></TouchableOpacity>
          {fotoAmpliada && <Image source={{ uri: fotoAmpliada }} style={styles.fullScreenImage} contentFit="contain" transition={300} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingTop: 10 },
    tituloTela: { fontSize: 28, fontWeight: "bold", color: c.text },
    seletorMes: { flexDirection: "row", alignItems: "center", backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: c.border },
    btnNav: { padding: 4 },
    subtituloTela: { fontSize: 13, color: c.text, fontWeight: "bold", marginHorizontal: 8, minWidth: 70, textAlign: "center" },
    listaContainer: { paddingHorizontal: 16, paddingBottom: 40 },
    cardTotal: { backgroundColor: c.card, padding: 20, borderRadius: 20, elevation: 2, marginBottom: 16, borderWidth: 1, borderColor: c.border },
    cardHeaderTotal: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    labelTotal: { fontSize: 12, fontWeight: "bold", color: c.textSecondary, marginLeft: 8, letterSpacing: 0.5 },
    valorTotal: { fontSize: 36, fontWeight: "900", color: c.danger, letterSpacing: -1 },
    cardIA: { backgroundColor: c.card, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
    btnPedirIA: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 16, justifyContent: 'center', alignItems: 'center' },
    txtPedirIA: { color: 'white', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
    cardInsight: { backgroundColor: c.background, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#FFC857", borderStyle: "dashed" },
    insightHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    insightTitulo: { color: c.text, fontWeight: "bold", marginLeft: 6, fontSize: 14 },
    insightLinha: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, alignItems: "center" },
    insightLabel: { color: c.textSecondary, fontSize: 12 },
    insightValor: { color: c.text, fontWeight: "bold", fontSize: 13, flex: 1, textAlign: "right", marginLeft: 10 },
    cardGrafico: { backgroundColor: c.card, padding: 20, borderRadius: 20, elevation: 2, marginBottom: 24, borderWidth: 1, borderColor: c.border },
    tituloGrafico: { fontSize: 16, fontWeight: "bold", color: c.text, marginBottom: 16 },
    linhaGrafico: { marginBottom: 12 },
    infoGrafico: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    textoCat: { fontSize: 13, fontWeight: "600", color: c.text },
    textoValorCat: { fontSize: 13, fontWeight: "bold", color: c.textSecondary },
    barraFundoGrafico: { height: 6, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" },
    barraPreenchidaGrafico: { height: "100%", borderRadius: 3 },
    headerListaRecibos: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    tituloSecao: { fontSize: 18, fontWeight: "bold", color: c.text },
    btnRefazer: { flexDirection: "row", alignItems: "center", backgroundColor: c.info, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 4 },
    itemCompra: { flexDirection: "row", backgroundColor: c.card, padding: 16, borderRadius: 16, marginBottom: 10, alignItems: "center", borderWidth: 1, borderColor: c.border },
    itemIcone: { width: 40, height: 40, borderRadius: 10, backgroundColor: c.background, justifyContent: "center", alignItems: "center", marginRight: 12 },
    itemDetalhes: { flex: 1, marginRight: 8 },
    itemNome: { fontSize: 15, fontWeight: "bold", color: c.text, marginBottom: 4 },
    itemCategoria: { fontSize: 12, color: c.tint, fontWeight: "600" },
    itemPrecoContainer: { alignItems: "flex-end" },
    itemPreco: { fontSize: 16, fontWeight: "800", color: c.text },
    emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
    textoVazio: { color: c.text, fontSize: 16, fontWeight: "bold", marginTop: 12, textAlign: "center" },
    subtextoVazio: { color: c.textSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
    reciboPapel: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 24, elevation: 10 },
    reciboHeader: { alignItems: "center", marginBottom: 10 },
    reciboTitulo: { fontSize: 18, fontWeight: "bold", color: "#1E1E1E", textTransform: "uppercase", letterSpacing: 1 },
    reciboMercado: { fontSize: 14, color: "#666", marginTop: 4 },
    reciboDivisor: { height: 1, width: "100%", borderWidth: 1, borderColor: "#E5E7EB", borderStyle: "dashed", marginVertical: 16 },
    reciboRowTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 10 },
    reciboTotalLabel: { fontSize: 16, fontWeight: "bold", color: "#1E1E1E" },
    reciboTotalValor: { fontSize: 24, fontWeight: "900", color: "#1E1E1E" },
    fotosContainer: { marginTop: 20, backgroundColor: "#F3F4F6", padding: 16, borderRadius: 12 },
    reciboLabelAnexos: { fontSize: 12, fontWeight: "bold", color: "#666", marginBottom: 10 },
    fotoRecibo: { width: 80, height: 80, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: "#D1D5DB" },
    btnFecharRecibo: { backgroundColor: "#1E1E1E", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 20 },
    btnFecharTexto: { color: "#FFFFFF", fontWeight: "bold", fontSize: 16 },
    fullScreenImageContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
    btnFecharImagem: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 10 },
    fullScreenImage: { width: "100%", height: "80%" },
  });