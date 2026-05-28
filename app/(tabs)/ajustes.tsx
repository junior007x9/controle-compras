import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview"; 
import { Image } from "expo-image";

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore";

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];
const UFS = ["PI", "MA", "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MG", "MS", "MT", "PA", "PB", "PE", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

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

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalGastoVida: 0, totalItensVida: 0, categoriaFavorita: "Nenhuma" });
  const [orcamentos, setOrcamentos] = useState<Record<string, string>>({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  const [notasGuardadas, setNotasGuardadas] = useState<any[]>([]);
  const [notaSelecionada, setNotaSelecionada] = useState<any>(null);
  const [modalVisualizarNota, setModalVisualizarNota] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [scannerSefazAtivo, setScannerSefazAtivo] = useState(false);
  const [modalSefazManual, setModalSefazManual] = useState(false);
  const [estadoSefaz, setEstadoSefaz] = useState<string>("PI"); 
  const [chaveSefaz, setChaveSefaz] = useState("");
  const [loadingSefaz, setLoadingSefaz] = useState(false);
  const [urlSefazWebView, setUrlSefazWebView] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);

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
      let total = 0; const cats: Record<string, number> = {};
      compras.forEach((item) => {
        let preco = Number(item.preco_prateleira) || 0;
        if (preco > 99999 || preco <= 0) preco = 0; 
        total += preco;
        const c = String(item.categoria || "Outros"); cats[c] = (cats[c] || 0) + 1;
      });
      let favorita = "Nenhuma"; let maxItens = 0;
      for (const [key, value] of Object.entries(cats)) { if (value > maxItens) { maxItens = value; favorita = key; } }
      setStats({ totalGastoVida: total, totalItensVida: compras.length, categoriaFavorita: favorita });
    } catch (error) {}
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

  const processarSefazScan = async ({ data }: { data: string }) => {
    if (!data.toLowerCase().startsWith('http')) {
      Alert.alert("Aviso", "O código QR lido não é um link web válido.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannerSefazAtivo(false); setUrlSefazWebView(data); 
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
         Alert.alert("Erro de Extração", "Ocorreu um erro interno na extração dos dados: " + json.detalhe);
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
        Alert.alert("Leitura Falhou", "O robô não encontrou os produtos. Se o site abriu na aba 'NF-e', clica primeiro na aba 'Produtos e Serviços' e tenta extrair novamente."); 
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
      "Aprovar Nota", "Deseja adicionar estes gastos ao seu Histórico?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sim, Adicionar", style: "default", onPress: async () => {
            setLoadingSefaz(true); setModalVisualizarNota(false);
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
              await turso.execute({ sql: "UPDATE notas_guardadas SET importada = 1 WHERE id = ?", args: [notaSelecionada.id] });
              await sincronizarComNuvem(); carregarEstatisticasGlobais(); carregarNotasGuardadas();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso", "Os gastos foram adicionados ao histórico!");
            } catch (e) { Alert.alert("Erro", "Falha na importação."); } finally { setLoadingSefaz(false); }
          }
        }
      ]
    );
  };

  const abrirDetalhesNota = (nota: any) => { setNotaSelecionada(nota); setModalVisualizarNota(true); };

  if (!permission && loading) return <View style={styles.center}><ActivityIndicator size="large" color={color.tint} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.tituloTela}>Ajustes & Consultas</Text>
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
                <TouchableOpacity style={styles.btnDangerOutline} onPress={() => { Alert.alert("Sair da Família", "Certeza?", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: () => { sairDaFamilia(); useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); } }]); }}>
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
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                  <TouchableOpacity style={[styles.btnAcaoPequeno, { flex: 1, backgroundColor: color.info }]} onPress={() => { requestPermission(); setScannerSefazAtivo(true); }}>
                    <Ionicons name="qr-code" size={20} color="white" /><Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 6 }}>QR Code</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnAcaoPequeno, { flex: 1, backgroundColor: color.card, borderWidth: 1, borderColor: color.info }]} onPress={() => { Haptics.selectionAsync(); setModalSefazManual(true); }}>
                    <Ionicons name="keypad" size={20} color={color.info} /><Text style={{ color: color.info, fontWeight: 'bold', marginLeft: 6 }}>Chave</Text>
                  </TouchableOpacity>
                </View>
                {notasGuardadas.slice(0, 5).map((nota) => (
                  <TouchableOpacity key={nota.id} style={styles.linhaNotaGuardada} onPress={() => abrirDetalhesNota(nota)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name={nota.importada ? "checkmark-circle" : "document-text"} size={24} color={nota.importada ? color.tint : color.textSecondary} />
                      <View style={{ marginLeft: 10, flex: 1, marginRight: 8 }}>
                        <Text style={{ color: color.text, fontWeight: 'bold' }} numberOfLines={1}>{nota.mercado}</Text>
                        <Text style={{ color: color.textSecondary, fontSize: 12 }}>{new Date(nota.data_extracao).toLocaleDateString('pt-BR')} • {JSON.parse(nota.itens_json).length} itens</Text>
                      </View>
                    </View>
                    <Text style={{ color: color.text, fontWeight: 'bold' }}>R$ {Number(nota.total || 0).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
                {notasGuardadas.length === 0 && <Text style={{ textAlign: 'center', color: color.textSecondary, padding: 10 }}>Nenhuma nota guardada.</Text>}
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
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}><Ionicons name="stats-chart" size={24} color="#FFC857" /><Text style={styles.tituloSecao}>Seu Histórico Vitalício</Text></View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Movimentado:</Text><Text style={[styles.valorEstatistica, { color: color.tint }]}>R$ {stats.totalGastoVida.toFixed(2)}</Text></View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Comprados:</Text><Text style={styles.valorEstatistica}>{stats.totalItensVida} itens</Text></View>
                <View style={styles.linhaEstatistica}><Text style={styles.labelEstatistica}>Secção favorita:</Text><Text style={styles.valorEstatistica}>{stats.categoriaFavorita}</Text></View>
              </View>

              <Text style={styles.labelGrupo}>PRIVACIDADE E DADOS</Text>
              <TouchableOpacity style={styles.btnAcaoDanger} onPress={resetarBancoDeDados}><View style={styles.btnAcaoLadoEsq}><Ionicons name="warning-outline" size={22} color={color.danger} /><Text style={styles.textoBtnDanger}>Zerar Histórico e Gaveta</Text></View></TouchableOpacity>

              <View style={styles.themeContainer}>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "light" && styles.themeBtnActive]} onPress={() => mudarTema("light")}><Ionicons name="sunny" size={24} color={temaAtivo === "light" ? color.tint : color.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "dark" && styles.themeBtnActive]} onPress={() => mudarTema("dark")}><Ionicons name="moon" size={24} color={temaAtivo === "dark" ? color.tint : color.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={[styles.themeBtn, temaAtivo === "system" && styles.themeBtnActive]} onPress={() => mudarTema("system")}><Ionicons name="phone-portrait" size={24} color={temaAtivo === "system" ? color.tint : color.textSecondary} /></TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.btnLogout} onPress={() => fazerLogout()}><Ionicons name="log-out" size={24} color="white" /><Text style={{ color: "white", fontWeight: "bold", marginLeft: 10, fontSize: 16 }}>Terminar Sessão</Text></TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL SCANNER QR CODE SEFAZ */}
      {scannerSefazAtivo && (
        <Modal visible={true} transparent={false} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={processarSefazScan} />
            <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }} pointerEvents="box-none">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 20 }}><TouchableOpacity onPress={() => setScannerSefazAtivo(false)}><Ionicons name="close-circle" size={40} color="white" /></TouchableOpacity></View>
              <View style={{ alignItems: 'center', marginBottom: 50 }}><View style={styles.miraQrCode}><Ionicons name="qr-code-outline" size={80} color="#10B981" /></View><Text style={{ color: 'white', fontWeight: 'bold', marginTop: 20, fontSize: 16 }}>Aponte para o QR Code da Nota</Text></View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* MODAL DIGITAR CHAVE MANUAL */}
      {modalSefazManual && (
        <Modal visible={true} transparent={true} animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalBackdrop}>
            <View style={styles.modalContentCentral}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 }}><Text style={{ fontSize: 18, fontWeight: 'bold', color: color.text }}>Chave Sefaz</Text><TouchableOpacity onPress={() => setModalSefazManual(false)}><Ionicons name="close-circle" size={28} color={color.textSecondary} /></TouchableOpacity></View>
                <View style={{ width: '100%', marginBottom: 20 }}><Text style={styles.labelInputManual}>Selecione o seu Estado (UF)</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>{UFS.map((uf) => (<TouchableOpacity key={uf} style={[styles.btnEstado, estadoSefaz === uf ? { backgroundColor: color.info, borderColor: color.info } : { backgroundColor: color.background, borderColor: color.border }, { marginRight: 8, paddingHorizontal: 16, paddingVertical: 10 }]} onPress={() => { Haptics.selectionAsync(); setEstadoSefaz(uf); }}><Text style={[styles.textoBtnEstado, estadoSefaz === uf && { color: 'white' }]}>{uf}</Text></TouchableOpacity>))}</ScrollView></View>
                <TextInput style={styles.inputModalManual} placeholder="Chave de Acesso (44 números)..." placeholderTextColor={color.borderDark} keyboardType="numeric" maxLength={44} value={chaveSefaz} onChangeText={setChaveSefaz} />
                <TouchableOpacity style={[styles.btnConfirmarDep, { backgroundColor: color.info, marginTop: 10 }]} onPress={processarSefazManual}><Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Aceder à Nota</Text></TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* 🔥 MODAL WEBVIEW EXTRATOR BLINDADO (NOVO CÉREBRO) */}
      {urlSefazWebView !== null && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: color.card, borderBottomWidth: 1, borderColor: color.border }}><Text style={{ fontWeight: 'bold', fontSize: 16, color: color.text }}>Extrator Dehouse</Text><TouchableOpacity onPress={() => setUrlSefazWebView(null)}><Ionicons name="close-circle" size={32} color={color.danger} /></TouchableOpacity></View>
            <WebView ref={webViewRef} source={{ uri: urlSefazWebView }} onMessage={(event) => processarExtracaoNativa(event.nativeEvent.data)} startInLoadingState={true} mixedContentMode="always" originWhitelist={['*']} domStorageEnabled={true} javaScriptEnabled={true} />
            
            <TouchableOpacity 
              style={[styles.btnExtrairFlutuante, { bottom: Math.max(insets.bottom + 20, 30) }]} 
              onPress={() => { 
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); 
                
                // 🔥 O NOVO ROBÔ: Super Cérebro que ignora lixo e calcula perfeitamente
                const jsNativo = `
                  try {
                    var itensExtraidos = [];
                    var totalSoma = 0.0;
                    
                    // FORÇAR A EXIBIÇÃO DE TUDO (Para ver as abas escondidas)
                    var ocultos = document.querySelectorAll('.ui-tabs-panel, [style*="display: none"], [style*="display:none"]');
                    for(var z=0; z<ocultos.length; z++) { ocultos[z].style.display = "block"; }

                    // 1. CAPTURAR O MERCADO E IGNORAR "AMBIENTE DE PRODUÇÃO"
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

                    // 2. LER A TABELA DE PRODUTOS CORRETAMENTE
                    var linhas = document.querySelectorAll('tr, .linhaProduto, #tabResult tr, table[id*="Itens"] tr');
                    
                    for (var i = 0; i < linhas.length; i++) {
                        var linha = linhas[i];
                        var textoLinha = linha.innerText.toUpperCase();
                        
                        // Pula lixo
                        if (!textoLinha || textoLinha.includes("CÓDIGO") || textoLinha.includes("DESCRIÇÃO") || textoLinha.includes("TOTAL") || textoLinha.includes("QTD.")) continue;

                        var nomeFinal = "";
                        var precoFinal = 0.0;
                        var qtdFinal = 1.0;

                        // Tenta encontrar as celulas da linha
                        var celulas = linha.querySelectorAll('td, span');
                        if (celulas.length >= 4) {
                            // No layout do PI/MA, geralmente a tabela é: Código | Descrição | Qtd | Un | Vl. Unit | Vl. Total
                            for (var c = 0; c < celulas.length; c++) {
                                var txt = celulas[c].innerText.trim();
                                
                                // O Nome é o primeiro texto longo que não é só número
                                if (txt.length > 4 && isNaN(parseFloat(txt.charAt(0))) && nomeFinal === "") {
                                    nomeFinal = txt;
                                }
                            }

                            // Extrair números (Qtd e Valor Total)
                            var numeros = [];
                            for (var c = 0; c < celulas.length; c++) {
                                var numStr = celulas[c].innerText.trim();
                                // Removemos letras, pegamos os números e convertemos a vírgula para ponto.
                                var numFormatado = numStr.replace(/[^0-9,]/g, '').replace(',', '.');
                                var valorFloat = parseFloat(numFormatado);
                                
                                if (!isNaN(valorFloat) && numFormatado !== "") {
                                    numeros.push(valorFloat);
                                }
                            }

                            // A lógica da Sefaz-PI: Se achou números, o primeiro costuma ser o Código, o segundo a Qtd, e o último o Valor Total.
                            // Mas para não errar, vamos pegar o último número (que é sempre o valor pago) e o penúltimo ou antepenúltimo (Qtd).
                            if (numeros.length >= 2) {
                                precoFinal = numeros[numeros.length - 1]; // O último é sempre o Vl. Total do item
                                
                                // Procura a quantidade. Geralmente é um número pequeno (como 1.0, 2.0). 
                                // O código do produto (SKU) é gigantesco, então vamos ignorá-lo.
                                for (var n = 0; n < numeros.length - 1; n++) {
                                    if (numeros[n] < 1000) { // Uma quantidade de supermercado raramente passa de 1000
                                        qtdFinal = numeros[n];
                                        break;
                                    }
                                }
                            }
                        } else {
                            // Layout alternativo (Cupom Amarelo antigo)
                            var elNome = linha.querySelector('.txtTit, .nomeProduto');
                            var elPreco = linha.querySelector('.RvlTotal, .valor, .txtValor');
                            var elQtd = linha.querySelector('.Rqtd, .qtd');

                            if (elNome && elPreco) {
                                nomeFinal = elNome.innerText.trim();
                                precoFinal = parseFloat(elPreco.innerText.replace(/[^0-9,]/g, '').replace(',', '.'));
                                if(elQtd) qtdFinal = parseFloat(elQtd.innerText.replace(/[^0-9,]/g, '').replace(',', '.'));
                            }
                        }

                        // Se encontrou um produto válido e real
                        if (nomeFinal !== "" && precoFinal > 0 && precoFinal < 50000 && 
                            !nomeFinal.toUpperCase().includes("AMBIENTE") && 
                            !nomeFinal.toUpperCase().includes("FORMA DE PAGAMENTO") &&
                            !nomeFinal.toUpperCase().includes("DESCONTO")) {
                            
                            itensExtraidos.push({
                                id: Math.random().toString(),
                                barras: "",
                                nome: nomeFinal,
                                preco: precoFinal.toFixed(2),
                                qtd: qtdFinal.toFixed(2),
                                categoria: "Outros"
                            });
                            
                            totalSoma += precoFinal;
                        }
                    }

                    // Envia os dados perfeitamente limpos para o aplicativo
                    window.ReactNativeWebView.postMessage(JSON.stringify({ 
                        mercado: mercadoText, 
                        total: totalSoma.toFixed(2), 
                        itens: itensExtraidos 
                    }));
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
    linhaNotaGuardada: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.background, padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: c.border },
    btnAcaoDanger: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: c.danger },
    textoBtnDanger: { color: c.danger, fontWeight: "600", fontSize: 15 },
    btnAcaoLadoEsq: { flexDirection: "row", alignItems: "center", gap: 12 },
    btnLogout: { backgroundColor: c.danger, padding: 18, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", elevation: 2, marginTop: 10 },
    miraQrCode: { padding: 30, borderWidth: 4, borderColor: c.info, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20, paddingVertical: 40 },
    modalContentCentral: { backgroundColor: c.card, borderRadius: 24, padding: 24, width: '100%', maxHeight: '90%' },
    btnEstado: { alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.border },
    textoBtnEstado: { color: c.textSecondary, fontWeight: 'bold' },
    labelInputManual: { fontSize: 12, fontWeight: "bold", color: c.textSecondary, marginBottom: 6, marginLeft: 4 },
    inputModalManual: { backgroundColor: c.background, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    btnConfirmarDep: { width: "100%", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
    btnExtrairFlutuante: { position: 'absolute', alignSelf: 'center', backgroundColor: c.info, paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, flexDirection: 'row', alignItems: 'center' }
  });