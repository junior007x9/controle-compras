import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview"; 
import { Image } from "expo-image";

// 🔥 IMPORTAÇÕES PARA O PDF E GRÁFICO
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { PieChart } from "react-native-chart-kit";

// 🔥 O BOTÃO DE LER NOTA FISCAL
import { BotaoLerNota } from "../../components/BotaoLerNota";

// 🔥 O MOTOR DE FAZER DINHEIRO (INTERSTITIAL AD)
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore";

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];
const UFS = ["PI", "MA", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MG", "MS", "MT", "PA", "PB", "PE", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
const screenWidth = Dimensions.get("window").width;

// 💰 ID do Anúncio (Usa o Test ID em ambiente de desenvolvimento)
const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-5151678673256465/2845620951'; 
const interstitial = InterstitialAd.createForAdRequest(adUnitId, { requestNonPersonalizedAdsOnly: true });

const SkeletonAjustes = ({ color }: { color: any }) => {
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
    <View>
      <View style={{ flexDirection: "row", backgroundColor: color.card, padding: 20, borderRadius: 20, marginBottom: 15, alignItems: "center", borderWidth: 1, borderColor: color.border }}>
        <Animated.View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color.border, opacity: fadeAnim, marginRight: 15 }} />
        <View style={{ flex: 1 }}>
          <Animated.View style={{ width: '60%', height: 18, borderRadius: 4, backgroundColor: color.border, opacity: fadeAnim, marginBottom: 8 }} />
          <Animated.View style={{ width: '40%', height: 14, borderRadius: 4, backgroundColor: color.border, opacity: fadeAnim }} />
        </View>
      </View>
      <Animated.View style={{ height: 150, borderRadius: 20, backgroundColor: color.card, opacity: fadeAnim, borderWidth: 1, borderColor: color.border, marginBottom: 15 }} />
      <Animated.View style={{ height: 200, borderRadius: 20, backgroundColor: color.card, opacity: fadeAnim, borderWidth: 1, borderColor: color.border }} />
    </View>
  );
};

export default function AjustesScreen() {
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo, setTema } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { usuario, familiaId, fazerLogout, sairDaFamilia } = useAuthStore();
  const { sincronizarComNuvem } = useCartStore(); 

  // 🔥 REDIRECIONAMENTO AUTOMÁTICO SE SAIR DA FAMÍLIA OU DA CONTA
  useEffect(() => {
    if (!usuario || !familiaId) {
      router.replace("/");
    }
  }, [usuario, familiaId]);

  const [loading, setLoading] = useState(true);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [stats, setStats] = useState({ totalGastoVida: 0, totalItensVida: 0, categoriaFavorita: "Nenhuma" });
  const [dadosDoGrafico, setDadosDoGrafico] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<Record<string, string>>({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [notasGuardadas, setNotasGuardadas] = useState<any[]>([]);
  
  const [notaSelecionada, setNotaSelecionada] = useState<any>(null);
  const [modalVisualizarNota, setModalVisualizarNota] = useState(false);

  const [modalAjudaVisivel, setModalAjudaVisivel] = useState(false);

  const [modalSefazManual, setModalSefazManual] = useState(false);
  const [estadoSefaz, setEstadoSefaz] = useState<string>("PI"); 
  const [chaveSefaz, setChaveSefaz] = useState("");
  const [loadingSefaz, setLoadingSefaz] = useState(false);
  const [urlSefazWebView, setUrlSefazWebView] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);

  const [anuncioPronto, setAnuncioPronto] = useState(false);

  useEffect(() => {
    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setAnuncioPronto(true);
    });
    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setAnuncioPronto(false);
      gerarPDFHistoricoInterno(); 
      interstitial.load(); 
    });
    
    interstitial.load();
    
    return () => { 
      unsubscribeLoaded(); 
      unsubscribeClosed(); 
    };
  }, []);

  const carregarTudo = async () => {
    setLoading(true);
    await inicializarBancosDeDados();
    await Promise.all([
      carregarEstatisticasGlobais(),
      carregarOrcamentos(),
      carregarNotasGuardadas()
    ]);
    setTimeout(() => setLoading(false), 500);
  };

  useFocusEffect(
    useCallback(() => {
      carregarTudo();
    }, [familiaId]),
  );

  const mudarTema = (novoTema: "light" | "dark" | "system") => { Haptics.selectionAsync(); setTema(novoTema); };

  const inicializarBancosDeDados = async () => {
    try {
      await turso.execute(`CREATE TABLE IF NOT EXISTS notas_guardadas (id TEXT PRIMARY KEY, familia_id TEXT, mercado TEXT, data_extracao TEXT, total REAL, itens_json TEXT, importada INTEGER DEFAULT 0)`);
    } catch (e) {}
  };

  const carregarNotasGuardadas = async () => {
    if (!familiaId) return;
    try {
      const res = await turso.execute({ sql: "SELECT * FROM notas_guardadas WHERE familia_id = ? ORDER BY data_extracao DESC", args: [familiaId] });
      setNotasGuardadas(res.rows as any[]);
    } catch (e) {}
  };

  const carregarOrcamentos = async () => {
    try {
      const salvos = await AsyncStorage.getItem(`dehouse_orcamentos_${familiaId}`);
      if (salvos) setOrcamentos(JSON.parse(salvos));
    } catch (e) {}
  };

  const atualizarOrcamento = async (cat: string, valor: string) => {
    const novos = { ...orcamentos, [cat]: valor.replace(",", ".") };
    setOrcamentos(novos);
    setSalvandoOrcamento(true);
    await AsyncStorage.setItem(`dehouse_orcamentos_${familiaId}`, JSON.stringify(novos));
    setTimeout(() => setSalvandoOrcamento(false), 500); 
  };

  const carregarEstatisticasGlobais = async () => {
    try {
      const result = await turso.execute({ sql: "SELECT preco_prateleira, categoria FROM compras_historico WHERE familia_id = ?", args: [familiaId || ""] });
      const compras = result.rows as any[];
      
      let total = 0; 
      const gastosPorValor: Record<string, number> = {};
      const gastosPorQtd: Record<string, number> = {};

      compras.forEach((item) => {
        let preco = Number(item.preco_prateleira) || 0;
        if (preco > 99999 || preco <= 0) preco = 0; 
        total += preco;
        
        const c = String(item.categoria || "Outros"); 
        gastosPorValor[c] = (gastosPorValor[c] || 0) + preco;
        gastosPorQtd[c] = (gastosPorQtd[c] || 0) + 1;
      });

      let favorita = "Nenhuma"; let maxItens = 0;
      for (const [key, value] of Object.entries(gastosPorQtd)) { 
        if (value > maxItens) { maxItens = value; favorita = key; } 
      }

      const coresDashboard = ["#10B981", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
      const arrayGrafico = Object.entries(gastosPorValor).map(([cat, val], index) => ({
        name: cat,
        population: Number(val.toFixed(2)),
        color: coresDashboard[index % coresDashboard.length],
        legendFontColor: color.textSecondary,
        legendFontSize: 13
      })).filter(i => i.population > 0);

      setStats({ totalGastoVida: total, totalItensVida: compras.length, categoriaFavorita: favorita });
      setDadosDoGrafico(arrayGrafico);
    } catch (error) {}
  };

  const clicarExportarPDF = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (anuncioPronto) {
      interstitial.show(); 
    } else {
      gerarPDFHistoricoInterno(); 
    }
  };

  const gerarPDFHistoricoInterno = async () => {
    if (!familiaId) return;
    setGerandoPDF(true);

    try {
      const result = await turso.execute({ 
        sql: "SELECT * FROM compras_historico WHERE familia_id = ? ORDER BY data_compra DESC", 
        args: [familiaId] 
      });
      const compras = result.rows as any[];

      if (compras.length === 0) {
        Alert.alert("Histórico Vazio", "Ainda não tem compras salvas no histórico para gerar um relatório.");
        setGerandoPDF(false);
        return;
      }

      let linhasTabela = "";
      let totalCalculado = 0;

      compras.forEach((compra) => {
        const preco = Number(compra.preco_prateleira) || 0;
        totalCalculado += preco;
        const dataFormatada = new Date(compra.data_compra).toLocaleDateString('pt-BR');
        
        linhasTabela += `
          <tr>
            <td>${dataFormatada}</td>
            <td>${compra.supermercado || 'Supermercado Local'}</td>
            <td>${compra.nome_produto}</td>
            <td>${compra.categoria || 'Outros'}</td>
            <td style="text-align: right; font-weight: bold;">R$ ${preco.toFixed(2)}</td>
          </tr>
        `;
      });

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
              .header { text-align: center; border-bottom: 2px solid #10B981; padding-bottom: 20px; margin-bottom: 30px; }
              h1 { color: #10B981; margin: 0; font-size: 28px; }
              .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
              .info-box { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 30px; font-size: 14px; }
              .info-box p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; font-size: 13px; }
              th, td { border-bottom: 1px solid #eee; padding: 12px 8px; text-align: left; }
              th { background-color: #f1f5f9; color: #334155; font-weight: bold; text-transform: uppercase; font-size: 12px; }
              tr:nth-child(even) { background-color: #fafafa; }
              .total-row { font-size: 18px; font-weight: bold; color: #10B981; text-align: right; margin-top: 20px; padding-top: 20px; border-top: 2px solid #10B981; }
              .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #999; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Dehouse Market</h1>
              <div class="subtitle">Extrato Completo de Compras</div>
            </div>
            
            <div class="info-box">
              <p><strong>Código da Família:</strong> ${familiaId}</p>
              <p><strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
              <p><strong>Total de Produtos Listados:</strong> ${compras.length}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Local/Mercado</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th style="text-align: right;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${linhasTabela}
              </tbody>
            </table>

            <div class="total-row">
              Gasto Total Acumulado: R$ ${totalCalculado.toFixed(2)}
            </div>

            <div class="footer">
              Relatório gerado automaticamente através da aplicação Dehouse Market.
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partilhar Histórico Dehouse',
        UTI: 'com.adobe.pdf'
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      Alert.alert("Erro", "Falha ao gerar o documento PDF.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGerandoPDF(false);
    }
  };

  const resetarBancoDeDados = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Zerar Aplicativo", "Isso apagará TODO o histórico de compras e as notas guardadas. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Zerar Tudo", style: "destructive", onPress: async () => {
            try {
              await turso.execute({ sql: "DELETE FROM compras_historico WHERE familia_id = ?", args: [familiaId || ""] });
              await turso.execute({ sql: "DELETE FROM notas_guardadas WHERE familia_id = ?", args: [familiaId || ""] });
              useCartStore.getState().atualizarSaldoBanco(0);
              await AsyncStorage.removeItem(`dehouse_checklist_${familiaId}`);
              await AsyncStorage.removeItem(`dehouse_orcamentos_${familiaId}`);
              setOrcamentos({});
              carregarEstatisticasGlobais(); carregarNotasGuardadas();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso", "O histórico foi zerado.");
            } catch (error) { Alert.alert("Erro", "Falha ao zerar."); }
          }
        },
      ]
    );
  };

  const processarSefazManual = async () => {
    if (chaveSefaz.length !== 44) return Alert.alert("Atenção", "A chave de acesso precisa ter exatos 44 números.");
    Keyboard.dismiss(); setModalSefazManual(false);
    
    const urlsSefaz: Record<string, string> = {
      "MA": `https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp?p=${chaveSefaz}`,
      "PI": `https://webas.sefaz.pi.gov.br/nfceweb/consultarNFCe.jsf?p=${chaveSefaz}`
    };
    setUrlSefazWebView(urlsSefaz[estadoSefaz] || `https://www.sefaz.${estadoSefaz.toLowerCase()}.gov.br/nfce/consulta?p=${chaveSefaz}`); 
  };

  const processarExtracaoNativa = async (dadosSefaz: string) => {
    setLoadingSefaz(true);
    try {
      const json = JSON.parse(dadosSefaz);
      
      if(json.erro) {
         Alert.alert("Erro de Extração", "Ocorreu um erro na extração dos dados. Verifique a nota.");
         setLoadingSefaz(false);
         return;
      }

      if(json && json.itens && json.itens.length > 0) {
        setUrlSefazWebView(null); 
        
        const totalLimpo = Number(json.total) || 0;
        const mercadoLimpo = json.mercado || "Supermercado Local";
        const itensLimpos = json.itens;

        const novoId = Date.now().toString();
        const dataHoje = new Date().toISOString();
        
        await turso.execute({
          sql: "INSERT INTO notas_guardadas (id, familia_id, mercado, data_extracao, total, itens_json, importada) VALUES (?, ?, ?, ?, ?, ?, 0)",
          args: [novoId, familiaId, mercadoLimpo, dataHoje, totalLimpo, JSON.stringify(itensLimpos)]
        });
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Nota Guardada!", `Encontrámos ${itensLimpos.length} produtos totalizando R$ ${totalLimpo.toFixed(2)}.`);
        carregarNotasGuardadas(); setChaveSefaz("");
      } else { 
        Alert.alert("Leitura Falhou", "O robô não encontrou os produtos. Clica na aba 'Produtos e Serviços' do site e tenta extrair novamente."); 
      }
    } catch(e) { 
      Alert.alert("Erro", "Falha ao processar os dados da Secretaria da Fazenda."); 
    } finally { 
      setLoadingSefaz(false); 
    }
  };

  const aprovarNotaParaHistorico = async () => {
    if (!notaSelecionada || notaSelecionada.importada) return;
    Alert.alert(
      "Salvar no Histórico", "Deseja adicionar todos os produtos desta nota ao seu histórico permanente para comparar preços no futuro?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, Adicionar", style: "default", onPress: async () => {
            setLoadingSefaz(true); 
            setModalVisualizarNota(false);
            try {
              const itens = JSON.parse(notaSelecionada.itens_json);
              const dataCalc = new Date(); 
              const mesReferencia = `${String(dataCalc.getMonth() + 1).padStart(2, "0")}-${dataCalc.getFullYear()}`;
              
              for (const item of itens) {
                await turso.execute({
                  sql: `INSERT INTO compras_historico (familia_id, codigo_barras, nome_produto, supermercado, preco_prateleira, preco_caixa, data_compra, mes_referencia, categoria) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  args: [familiaId, item.barras || "", item.nome, notaSelecionada.mercado, item.preco, item.preco, dataCalc.toISOString(), mesReferencia, item.categoria || "Outros"],
                });
              }
              await turso.execute({ sql: "UPDATE notas_guardadas SET importada = 1 WHERE id = ?" , args: [notaSelecionada.id] });
              await sincronizarComNuvem(); carregarEstatisticasGlobais(); carregarNotasGuardadas();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso!", "Os produtos foram adicionados ao seu Histórico Inteligente!");
            } catch (e) { Alert.alert("Erro", "Falha na importação."); } finally { setLoadingSefaz(false); }
          }
        }
      ]
    );
  };

  const abrirDetalhesNota = (nota: any) => { 
    setNotaSelecionada(nota); 
    setModalVisualizarNota(true); 
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={color.tint} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        
        <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <Text style={styles.tituloTela}>Ajustes & Consultas</Text>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.tint + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
            onPress={() => { Haptics.selectionAsync(); setModalAjudaVisivel(true); }}
          >
            <Ionicons name="help-buoy" size={18} color={color.tint} />
            <Text style={{ color: color.tint, fontWeight: 'bold', marginLeft: 4, fontSize: 13 }}>Como usar?</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
          {loading ? (
            <SkeletonAjustes color={color} />
          ) : (
            <>
              <View style={styles.perfilCard}>
                <Image source={{ uri: usuario?.foto }} style={styles.fotoPerfil} contentFit="cover" transition={300} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nomeUsuario} numberOfLines={1}>{usuario?.nome}</Text>
                  <Text style={styles.emailUsuario} numberOfLines={1}>{usuario?.email}</Text>
                </View>
              </View>

              <View style={styles.cardInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  <Ionicons name="home" size={24} color={color.tint} />
                  <Text style={styles.tituloSecao}>Código da Família: <Text style={{ fontWeight: "900" }}>{familiaId}</Text></Text>
                </View>
                <TouchableOpacity style={styles.btnDangerOutline} onPress={() => { 
                    Alert.alert("Sair da Família", "Deseja sair desta família? Terá de inserir um código novamente para voltar.", [
                        { text: "Cancelar", style: "cancel" }, 
                        { text: "Sair", style: "destructive", onPress: () => { 
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            sairDaFamilia(); 
                            useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); 
                        } }
                    ]); 
                }}>
                  <Text style={styles.textDanger}>Sair desta Família</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.labelGrupo}>A SUA GAVETA DE NOTAS FISCAIS</Text>
              <View style={[styles.cardEstatistica, { borderColor: color.info, borderWidth: 2 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  <Ionicons name="folder-open" size={24} color={color.info} />
                  <Text style={styles.tituloSecao}>Recibos Extraídos ({notasGuardadas.length})</Text>
                </View>
                <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>Guarde os seus recibos aqui de forma invisível. Adicione-os ao orçamento apenas se quiser.</Text>
                
                {/* 🔥 BOTÕES DE IMPORTAÇÃO (CÂMARA E MANUAL) */}
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <BotaoLerNota color={color} />
                  
                  <TouchableOpacity style={[styles.btnAcaoPequeno, { backgroundColor: color.background, borderWidth: 1, borderColor: color.info }]} onPress={() => { Haptics.selectionAsync(); setModalSefazManual(true); }}>
                    <Ionicons name="keypad" size={20} color={color.info} />
                    <Text style={{ color: color.info, fontWeight: 'bold', marginLeft: 6 }}>Digitar Chave Manualmente</Text>
                  </TouchableOpacity>
                </View>
                
                {notasGuardadas.map((nota) => (
                  <TouchableOpacity 
                    key={nota.id} 
                    style={[styles.cardComprovante, { backgroundColor: color.card, borderColor: color.border }]} 
                    onPress={() => abrirDetalhesNota(nota)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconeLateral, { backgroundColor: nota.importada ? color.tint + '20' : color.info + '20' }]}>
                      <Ionicons name={nota.importada ? "checkmark-circle" : "receipt"} size={24} color={nota.importada ? color.tint : color.info} />
                    </View>
                    <View style={styles.textosContainer}>
                      <Text style={[styles.nomeItemCard, { color: color.text }]} numberOfLines={1}>{nota.mercado}</Text>
                      <Text style={[styles.categoriaItemCard, { color: color.textSecondary }]}>
                        {new Date(nota.data_extracao).toLocaleDateString('pt-BR')} • {JSON.parse(nota.itens_json).length} itens
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.valorTotal, { color: color.text }]}>R$ {Number(nota.total || 0).toFixed(2)}</Text>
                      {nota.importada && <Text style={{fontSize: 10, color: color.tint, fontWeight: 'bold', marginTop: 2}}>GUARDADO</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
                
                {notasGuardadas.length === 0 && <Text style={{ textAlign: 'center', color: color.textSecondary, padding: 10, fontStyle: 'italic' }}>Nenhuma nota extraída ainda.</Text>}
              </View>

              <Text style={styles.labelGrupo}>CONTROLE DE ORÇAMENTO</Text>
              <View style={styles.cardEstatistica}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}><Ionicons name="pie-chart" size={24} color={color.tint} /><Text style={styles.tituloSecao}>Limites por Categoria</Text></View>
                  {salvandoOrcamento && <ActivityIndicator size="small" color={color.tint} />}
                </View>
                {CATEGORIAS.map((cat) => (
                  <View key={cat} style={styles.linhaOrcamento}>
                    <Text style={styles.textoCatOrcamento}>{cat}</Text>
                    <View style={styles.inputContainerOrcamento}><Text style={{ color: color.textSecondary, marginRight: 4 }}>R$</Text><TextInput style={styles.inputOrcamento} keyboardType="numeric" placeholder="0,00" placeholderTextColor={color.borderDark} value={orcamentos[cat] || ""} onChangeText={(val) => atualizarOrcamento(cat, val)} /></View>
                  </View>
                ))}
              </View>

              <Text style={styles.labelGrupo}>ESTATÍSTICAS VITAIS</Text>
              <View style={styles.cardEstatistica}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                  <Ionicons name="stats-chart" size={24} color="#FFC857" />
                  <Text style={styles.tituloSecao}>Seu Histórico Vitalício</Text>
                </View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Movimentado:</Text><Text style={[styles.valorEstatistica, { color: color.tint }]}>R$ {stats.totalGastoVida.toFixed(2)}</Text></View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Comprados:</Text><Text style={styles.valorEstatistica}>{stats.totalItensVida} itens</Text></View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Secção favorita:</Text><Text style={styles.valorEstatistica}>{stats.categoriaFavorita}</Text></View>
                
                {dadosDoGrafico.length > 0 ? (
                  <View style={{ alignItems: "center", marginTop: 20, marginBottom: 10 }}>
                    <Text style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: "bold", color: color.textSecondary, marginBottom: 10 }}>PARA ONDE VAI O SEU DINHEIRO?</Text>
                    <PieChart
                      data={dadosDoGrafico}
                      width={screenWidth - 80}
                      height={180}
                      chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                      accessor={"population"}
                      backgroundColor={"transparent"}
                      paddingLeft={"15"}
                      center={[0, 0]}
                      absolute={true}
                    />
                  </View>
                ) : (
                  <Text style={{ textAlign: "center", color: color.textSecondary, marginTop: 20, fontStyle: "italic" }}>Faça a sua primeira compra para gerar o gráfico financeiro.</Text>
                )}

                <TouchableOpacity 
                  style={[styles.btnAcaoPequeno, { backgroundColor: color.tint, marginTop: 20, paddingVertical: 14 }]} 
                  onPress={clicarExportarPDF}
                  disabled={gerandoPDF}
                >
                  {gerandoPDF ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="document-text" size={20} color="white" />
                      <Text style={{ color: "white", fontWeight: "bold", marginLeft: 8, fontSize: 15 }}>Exportar Relatório (PDF)</Text>
                    </>
                  )}
                </TouchableOpacity>

              </View>

              <Text style={styles.labelGrupo}>PRIVACIDADE E DADOS</Text>
              <TouchableOpacity style={styles.btnAcaoDanger} onPress={resetarBancoDeDados}><View style={styles.btnAcaoLadoEsq}><Ionicons name="warning-outline" size={22} color={color.danger} /><Text style={styles.textoBtnDanger}>Zerar Histórico e Gaveta</Text></View></TouchableOpacity>

              <View style={styles.themeContainer}>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "light" && styles.themeBtnActive]} onPress={() => mudarTema("light")}><Ionicons name="sunny" size={24} color={temaAtivo === "light" ? color.tint : color.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "dark" && styles.themeBtnActive]} onPress={() => mudarTema("dark")}><Ionicons name="moon" size={24} color={temaAtivo === "dark" ? color.tint : color.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "system" && styles.themeBtnActive]} onPress={() => mudarTema("system")}><Ionicons name="phone-portrait" size={24} color={temaAtivo === "system" ? color.tint : color.textSecondary} /></TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.btnLogout} onPress={() => { 
                Alert.alert("Terminar Sessão", "Deseja sair da sua conta inteira?", [
                    { text: "Cancelar", style: "cancel" }, 
                    { text: "Sair", style: "destructive", onPress: () => { 
                        fazerLogout(); 
                        useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); 
                    } }
                ]); 
              }}><Ionicons name="log-out" size={24} color="white" /><Text style={{ color: "white", fontWeight: "bold", marginLeft: 10, fontSize: 16 }}>Terminar Sessão</Text></TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {modalVisualizarNota && notaSelecionada && (
        <Modal visible={true} transparent={true} animationType="slide">
          <View style={localStyles.modalBackdrop}>
            <View style={[localStyles.modalContentCentral, { backgroundColor: color.card, borderColor: color.border, borderWidth: 1, paddingBottom: Math.max(insets.bottom + 20, 24) }]}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: color.text }}>Detalhes da Nota</Text>
                <TouchableOpacity onPress={() => setModalVisualizarNota(false)}>
                  <Ionicons name="close-circle" size={28} color={color.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ backgroundColor: color.background, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: color.border }}>
                <Text style={{ color: color.text, fontWeight: 'bold', fontSize: 16 }}>{notaSelecionada.mercado}</Text>
                <Text style={{ color: color.textSecondary, fontSize: 12, marginTop: 4 }}>Total do Recibo: <Text style={{ fontWeight: 'bold', color: color.text }}>R$ {Number(notaSelecionada.total).toFixed(2)}</Text></Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300, marginBottom: 16 }}>
                {JSON.parse(notaSelecionada.itens_json).map((item: any, index: number) => (
                  <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.border }}>
                    <Text style={{ color: color.text, flex: 1, marginRight: 10 }} numberOfLines={1}>{item.qtd}x {item.nome}</Text>
                    <Text style={{ color: color.text, fontWeight: 'bold' }}>R$ {Number(item.preco).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>

              {!notaSelecionada.importada ? (
                <TouchableOpacity style={[localStyles.btnConfirmarDep, { backgroundColor: color.tint }]} onPress={aprovarNotaParaHistorico}>
                  <Ionicons name="cloud-upload" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Adicionar ao Histórico</Text>
                </TouchableOpacity>
              ) : (
                <View style={[localStyles.btnConfirmarDep, { backgroundColor: color.background, borderWidth: 1, borderColor: color.border }]}>
                  <Ionicons name="checkmark-circle" size={20} color={color.tint} style={{ marginRight: 8 }} />
                  <Text style={{ color: color.textSecondary, fontWeight: 'bold', fontSize: 16 }}>Já adicionado ao Histórico</Text>
                </View>
              )}

            </View>
          </View>
        </Modal>
      )}

      {modalSefazManual && (
        <Modal visible={true} transparent={true} animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={localStyles.modalBackdrop}>
            <View style={localStyles.modalContentCentral}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 }}><Text style={{ fontSize: 18, fontWeight: 'bold', color: color.text }}>Chave Sefaz</Text><TouchableOpacity onPress={() => setModalSefazManual(false)}><Ionicons name="close-circle" size={28} color={color.textSecondary} /></TouchableOpacity></View>
                <View style={{ width: '100%', marginBottom: 20 }}><Text style={localStyles.labelInputManual}>Selecione o seu Estado (UF)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>{UFS.map((uf) => (<TouchableOpacity key={uf} style={[localStyles.btnEstado, estadoSefaz === uf ? { backgroundColor: color.info, borderColor: color.info } : { backgroundColor: color.background, borderColor: color.border }, { marginRight: 8, paddingHorizontal: 16, paddingVertical: 10 }]} onPress={() => { Haptics.selectionAsync(); setEstadoSefaz(uf); }}><Text style={[localStyles.textoBtnEstado, estadoSefaz === uf && { color: 'white' }]}>{uf}</Text></TouchableOpacity>))}</ScrollView></View>
                <TextInput style={[localStyles.inputModalManual, { backgroundColor: color.background, color: color.text, borderColor: color.border }]} placeholder="Chave de Acesso (44 números)..." placeholderTextColor={color.borderDark} keyboardType="numeric" maxLength={44} value={chaveSefaz} onChangeText={setChaveSefaz} />
                <TouchableOpacity style={[localStyles.btnConfirmarDep, { backgroundColor: color.info, marginTop: 10 }]} onPress={processarSefazManual}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Aceder à Nota</Text></TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {urlSefazWebView !== null && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: color.card, borderBottomWidth: 1, borderColor: color.border }}><Text style={{ fontWeight: 'bold', fontSize: 16, color: color.text }}>Extrator Dehouse</Text><TouchableOpacity onPress={() => setUrlSefazWebView(null)}><Ionicons name="close-circle" size={32} color={color.danger} /></TouchableOpacity></View>
            <WebView ref={webViewRef} source={{ uri: urlSefazWebView }} onMessage={(event) => processarExtracaoNativa(event.nativeEvent.data)} startInLoadingState={true} mixedContentMode="always" originWhitelist={['*']} domStorageEnabled={true} javaScriptEnabled={true} />
            
            <TouchableOpacity 
              style={[localStyles.btnExtrairFlutuante, { backgroundColor: color.info, bottom: Math.max(insets.bottom + 20, 30) }]} 
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); 
                const jsNativo = `
                  try {
                    var itensExtraidos = [];
                    var totalSoma = 0.0;
                    var ocultos = document.querySelectorAll('.ui-tabs-panel, [style*="display: none"], [style*="display:none"]');
                    for(var z=0; z<ocultos.length; z++) { ocultos[z].style.display = "block"; }
                    var mercadoText = "Supermercado";
                    var possiveisNomes = document.querySelectorAll('#u20, .txtTopo, #conteudo\\\\:txtNomeEmitente, .NFCCabecalho_SubTitulo, span[id*="EmitenteNome"]');
                    for (var i = 0; i < possiveisNomes.length; i++) {
                        var texto = possiveisNomes[i].innerText.trim();
                        var textoUpper = texto.toUpperCase();
                        if (texto.length > 5 && !textoUpper.includes("AMBIENTE") && !textoUpper.includes("EMISSÃO") && !textoUpper.includes("CONSULTA")) {
                            mercadoText = texto;
                            break;
                        }
                    }
                    var linhas = document.querySelectorAll('tr, .linhaProduto, #tabResult tr, table[id*="Itens"] tr');
                    for (var i = 0; i < linhas.length; i++) {
                        var linha = linhas[i];
                        var textoLinha = linha.innerText.toUpperCase();
                        if (!textoLinha || textoLinha.includes("CÓDIGO") || textoLinha.includes("DESCRIÇÃO") || textoLinha.includes("TOTAL") || textoLinha.includes("QTD.")) continue;
                        var nomeFinal = ""; var precoFinal = 0.0; var qtdFinal = 1.0;
                        var celulas = linha.querySelectorAll('td, span');
                        if (celulas.length >= 4) {
                            for (var c = 0; c < celulas.length; c++) {
                                var txt = celulas[c].innerText.trim();
                                if (txt.length > 4 && isNaN(parseFloat(txt.charAt(0))) && nomeFinal === "") { nomeFinal = txt; }
                            }
                            var numeros = [];
                            for (var c = 0; c < celulas.length; c++) {
                                var numStr = celulas[c].innerText.trim();
                                var numFormatado = numStr.replace(/[^0-9,]/g, '').replace(',', '.');
                                var valorFloat = parseFloat(numFormatado);
                                if (!isNaN(valorFloat) && numFormatado !== "") { numeros.push(valorFloat); }
                            }
                            if (numeros.length >= 2) {
                                precoFinal = numeros[numeros.length - 1]; 
                                for (var n = 0; n < numeros.length - 1; n++) {
                                    if (numeros[n] < 1000) { qtdFinal = numeros[n]; break; }
                                }
                            }
                        } else {
                            var elNome = linha.querySelector('.txtTit, .nomeProduto');
                            var elPreco = linha.querySelector('.RvlTotal, .valor, .txtValor');
                            var elQtd = linha.querySelector('.Rqtd, .qtd');
                            if (elNome && elPreco) {
                                nomeFinal = elNome.innerText.trim();
                                precoFinal = parseFloat(elPreco.innerText.replace(/[^0-9,]/g, '').replace(',', '.'));
                                if(elQtd) qtdFinal = parseFloat(elQtd.innerText.replace(/[^0-9,]/g, '').replace(',', '.'));
                            }
                        }
                        if (nomeFinal !== "" && precoFinal > 0 && precoFinal < 50000 && !nomeFinal.toUpperCase().includes("AMBIENTE") && !nomeFinal.toUpperCase().includes("FORMA DE PAGAMENTO") && !nomeFinal.toUpperCase().includes("DESCONTO")) {
                            itensExtraidos.push({ id: Math.random().toString(), barras: "", nome: nomeFinal, preco: precoFinal.toFixed(2), qtd: qtdFinal.toFixed(2), categoria: "Outros" });
                            totalSoma += precoFinal;
                        }
                    }
                    window.ReactNativeWebView.postMessage(JSON.stringify({ mercado: mercadoText, total: totalSoma.toFixed(2), itens: itensExtraidos }));
                  } catch (e) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ erro: true, detalhe: e.message }));
                  }
                  true;
                `; 
                webViewRef.current?.injectJavaScript(jsNativo); 
              }}
            >
              <Ionicons name="download" size={24} color="white" style={{ marginRight: 8 }} />
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Extrair Dados</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}

      {loadingSefaz && (<Modal visible={true} transparent={true} animationType="fade"><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={color.info} /><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 20 }}>Processando...</Text></View></Modal>)}

      {modalAjudaVisivel && (
        <Modal visible={true} transparent={true} animationType="slide">
          <View style={localStyles.modalBackdrop}>
            <View style={[localStyles.modalCard, { backgroundColor: color.card, borderColor: color.border, padding: 0, overflow: 'hidden' }]}>
              
              <View style={{ backgroundColor: color.tint, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Dicas desta tela</Text>
                <TouchableOpacity onPress={() => setModalAjudaVisivel(false)}>
                  <Ionicons name="close-circle" size={28} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20, maxHeight: 400 }}>
                
                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: color.info + '30' }]}>
                    <Ionicons name="receipt" size={28} color={color.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>Gaveta de Notas Fiscais</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>Já tem uma nota fiscal do mercado? Clique em "Adicionar Nota Sefaz" e escreva os 44 números que o nosso robô lê os produtos todos e guarda-os para si.</Text>
                  </View>
                </View>

                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: color.tint + '30' }]}>
                    <Ionicons name="pie-chart" size={28} color={color.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>Controle de Orçamento</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>Defina limites. Por exemplo: se escrever 500 no campo "Alimentação", vai saber sempre se as suas idas ao supermercado estão a passar da conta.</Text>
                  </View>
                </View>

                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: '#FFC857' + '30' }]}>
                    <Ionicons name="stats-chart" size={28} color="#FFC857" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>Estatísticas e PDF</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>O gráfico mostra exatamente onde gasta mais dinheiro. Se clicar em "Exportar", nós geramos um documento lindo para imprimir ou partilhar no WhatsApp!</Text>
                  </View>
                </View>

              </ScrollView>

              <TouchableOpacity style={[localStyles.btnEntendi, { backgroundColor: color.background, borderTopColor: color.border, borderTopWidth: 1 }]} onPress={() => setModalAjudaVisivel(false)}>
                <Text style={{ color: color.tint, fontWeight: 'bold', fontSize: 16 }}>Percebi, obrigado!</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      )}

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
    perfilCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.card, padding: 20, borderRadius: 20, marginBottom: 15, elevation: 1, borderWidth: 1, borderColor: c.border },
    fotoPerfil: { width: 56, height: 56, borderRadius: 28, marginRight: 15, backgroundColor: c.border },
    nomeUsuario: { fontSize: 18, fontWeight: "bold", color: c.text },
    emailUsuario: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    cardInfo: { backgroundColor: c.card, padding: 20, borderRadius: 20, marginBottom: 30, elevation: 1, borderWidth: 1, borderColor: c.border },
    btnDangerOutline: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.danger, alignItems: "center" },
    textDanger: { color: c.danger, fontWeight: "bold" },
    themeContainer: { flexDirection: "row", justifyContent: "space-between", backgroundColor: c.card, padding: 8, borderRadius: 20, marginBottom: 30, elevation: 1, borderWidth: 1, borderColor: c.border },
    themeBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16 },
    themeBtnActive: { backgroundColor: c.border },
    cardEstatistica: { backgroundColor: c.card, padding: 20, borderRadius: 20, elevation: 1, marginBottom: 30, borderWidth: 1, borderColor: c.border },
    tituloSecao: { fontSize: 16, fontWeight: "bold", color: c.text, marginLeft: 10 },
    linhaOrcamento: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    textoCatOrcamento: { color: c.text, fontSize: 15, fontWeight: "600" },
    inputContainerOrcamento: { flexDirection: "row", alignItems: "center", backgroundColor: c.background, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: c.border, width: 100 },
    inputOrcamento: { flex: 1, height: 40, color: c.text, fontWeight: "bold", textAlign: "right" },
    linhaEstatistica: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
    labelEstatistica: { color: c.textSecondary, fontSize: 14, fontWeight: "500" },
    valorEstatistica: { color: c.text, fontSize: 16, fontWeight: "bold" },
    labelGrupo: { fontSize: 12, fontWeight: "bold", color: c.textSecondary, marginLeft: 8, marginBottom: 10, letterSpacing: 1 },
    btnAcaoPequeno: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 12, borderRadius: 12 },
    cardComprovante: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    iconeLateral: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
    textosContainer: { flex: 1, marginRight: 8 },
    nomeItemCard: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
    categoriaItemCard: { fontSize: 12, fontWeight: '600' },
    valorTotal: { fontSize: 16, fontWeight: '900' },
    btnAcaoDanger: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: c.danger },
    textoBtnDanger: { color: c.danger, fontWeight: "600", fontSize: 15 },
    btnAcaoLadoEsq: { flexDirection: "row", alignItems: "center", gap: 12 },
    btnLogout: { backgroundColor: c.danger, padding: 18, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", elevation: 2, marginTop: 10 },
  });

const localStyles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 20 },
  modalContentCentral: { borderRadius: 24, padding: 24, width: '100%', maxHeight: '90%' },
  btnEstado: { alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  textoBtnEstado: { fontWeight: 'bold' },
  labelInputManual: { fontSize: 12, fontWeight: "bold", marginBottom: 6, marginLeft: 4 },
  inputModalManual: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 15, borderWidth: 1, marginBottom: 10 },
  btnConfirmarDep: { width: "100%", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10, flexDirection: 'row', justifyContent: 'center' },
  btnExtrairFlutuante: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, flexDirection: 'row', alignItems: 'center' },
  modalCard: { borderRadius: 24, borderWidth: 1, width: '100%', elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  helpItem: { flexDirection: 'row', marginBottom: 20, alignItems: 'center' },
  helpIconWrapper: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  helpTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  btnEntendi: { padding: 20, alignItems: 'center', justifyContent: 'center' }
});