import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview"; // 🔥 IMPORTAÇÃO DO WEBVIEW

import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { extrairNotaDaSefaz, sugerirOrcamentoInteligente } from "../../services/iaService";

// Lojas de Estado (Stores)
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore";

const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

export default function AjustesScreen() {
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo, setTema } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);
  const router = useRouter();

  const { usuario, familiaId, fazerLogout, sairDaFamilia } = useAuthStore();
  const { adicionarVariosItens } = useCartStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalGastoVida: 0,
    totalItensVida: 0,
    categoriaFavorita: "Nenhuma",
  });

  const [orcamentos, setOrcamentos] = useState<Record<string, string>>({});
  const [salvandoOrcamento, setSalvandoOrcamento] = useState(false);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerSefazAtivo, setScannerSefazAtivo] = useState(false);
  
  const [modalSefazManual, setModalSefazManual] = useState(false);
  const [estadoSefaz, setEstadoSefaz] = useState<string>("SP");
  const [chaveSefaz, setChaveSefaz] = useState("");
  const [nfeSefaz, setNfeSefaz] = useState("");
  const [serieSefaz, setSerieSefaz] = useState("");
  const [emissaoSefaz, setEmissaoSefaz] = useState("");
  const [protocoloSefaz, setProtocoloSefaz] = useState("");
  const [dataAutSefaz, setDataAutSefaz] = useState("");

  const [loadingIA, setLoadingIA] = useState(false);
  const [statusIA, setStatusIA] = useState("");

  // 🔥 ESTADOS DO NAVEGADOR SEFAZ (CONTORNO DO CAPTCHA)
  const [urlSefazWebView, setUrlSefazWebView] = useState<string | null>(null);
  const webViewRef = useRef<any>(null);

  useFocusEffect(
    useCallback(() => {
      carregarEstatisticasGlobais();
      carregarOrcamentos();
    }, [familiaId]),
  );

  const mudarTema = (novoTema: "light" | "dark" | "system") => {
    Haptics.selectionAsync();
    setTema(novoTema);
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
    setLoading(true);
    try {
      const result = await turso.execute({
        sql: "SELECT preco_prateleira, categoria FROM compras_historico WHERE familia_id = ?",
        args: [familiaId || ""]
      });
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
    } catch (error) {} finally {
      setLoading(false);
    }
  };

  const exportarDados = async () => {
    Haptics.selectionAsync();
    try {
      const result = await turso.execute({
        sql: "SELECT * FROM compras_historico WHERE familia_id = ? ORDER BY id DESC LIMIT 100",
        args: [familiaId || ""]
      });
      const compras = result.rows as any[];
      if (compras.length === 0) return Alert.alert("Vazio", "Você não tem compras.");

      let csvString = "DADOS EXPORTADOS DO DEHOUSE\n\n";
      compras.forEach((c) => {
        csvString += `[${c.mes_referencia}] ${c.nome_produto} (${c.supermercado || "Mercado"}) - R$ ${Number(c.preco_prateleira).toFixed(2)}\n`;
      });
      await Share.share({ message: csvString, title: "Meus Dados Dehouse" });
    } catch (error) { Alert.alert("Erro", "Não foi possível exportar os dados."); }
  };

  const resetarBancoDeDados = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Zerar Aplicativo",
      "Isso apagará TODO o histórico de compras da sua família. Tem certeza?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Zerar Tudo",
          style: "destructive",
          onPress: async () => {
            try {
              await turso.execute({
                sql: "DELETE FROM compras_historico WHERE familia_id = ?",
                args: [familiaId || ""]
              });
              useCartStore.getState().atualizarSaldoBanco(0);
              await AsyncStorage.removeItem(`dehouse_checklist_${familiaId}`);
              await AsyncStorage.removeItem("compras_offline");
              await AsyncStorage.removeItem(`dehouse_orcamentos_${familiaId}`);
              setOrcamentos({});
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sucesso", "O histórico da sua família foi zerado.");
              carregarEstatisticasGlobais();
            } catch (error) { Alert.alert("Erro", "Falha ao zerar."); }
          },
        },
      ],
    );
  };

  const pedirSugestaoOrcamento = async () => {
    Haptics.selectionAsync();
    setLoadingIA(true);
    setStatusIA("Analisando seu histórico...");
    try {
      const result = await turso.execute({
        sql: "SELECT preco_prateleira, categoria FROM compras_historico WHERE familia_id = ?",
        args: [familiaId || ""]
      });
      const gastosCat: Record<string, number> = {};
      result.rows.forEach(r => {
        const cat = String(r.categoria || "Outros");
        gastosCat[cat] = (gastosCat[cat] || 0) + (Number(r.preco_prateleira) || 0);
      });
      
      const sugestao = await sugerirOrcamentoInteligente(JSON.stringify(gastosCat));
      if(sugestao) {
        setOrcamentos(sugestao);
        await AsyncStorage.setItem(`dehouse_orcamentos_${familiaId}`, JSON.stringify(sugestao));
        Alert.alert("Orçamento Atualizado", "A IA definiu as metas baseadas no seu histórico.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível gerar a sugestão agora.");
    } finally {
      setLoadingIA(false);
    }
  };

  // 🔥 1. SCANNER AGORA APENAS PREPARA A URL DO WEBVIEW
  const processarSefazScan = async ({ data }: { data: string }) => {
    if (!data.toLowerCase().startsWith('http')) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setScannerSefazAtivo(false);
    const urlSegura = data.replace(/^http:\/\//i, 'https://');
    setUrlSefazWebView(urlSegura); // Abre o navegador invisível ao bloqueio
  };

  // 🔥 2. MODO MANUAL AGORA APENAS PREPARA A URL DO WEBVIEW
  const processarSefazManual = async () => {
    if (chaveSefaz.length !== 44) {
      Alert.alert("Atenção", "A chave de acesso precisa ter 44 números.");
      return;
    }
    Keyboard.dismiss();
    setModalSefazManual(false);

    const urlsSefaz: Record<string, string> = {
      "AC": `http://hml.sefaznet.ac.gov.br/nfce/consulta?p=${chaveSefaz}`,
      "AL": `http://nfce.sefaz.al.gov.br/consultaNFCe.htm?p=${chaveSefaz}`,
      "AM": `https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?p=${chaveSefaz}`,
      "AP": `https://www.sefaz.ap.gov.br/sate/nfce/consulta.action?p=${chaveSefaz}`,
      "BA": `http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=${chaveSefaz}`,
      "CE": `http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=${chaveSefaz}`,
      "DF": `http://dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p=${chaveSefaz}`,
      "ES": `http://app.sefaz.es.gov.br/ConsultaNFCe/qrcode.aspx?p=${chaveSefaz}`,
      "GO": `http://nfe.sefaz.go.gov.br/nfeweb/sites/nfce/danfeNFCe?p=${chaveSefaz}`,
      "MA": `https://nfce.sefaz.ma.gov.br/portal/consultarNFCe.jsp?p=${chaveSefaz}`,
      "MG": `http://nfce.fazenda.mg.gov.br/portalnfce/sistema/qrcode.xhtml?p=${chaveSefaz}`,
      "MS": `http://www.dfe.ms.gov.br/nfce/consulta?p=${chaveSefaz}`,
      "MT": `http://www.sefaz.mt.gov.br/nfce/consultanfce?p=${chaveSefaz}`,
      "PA": `https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/consultanfce.seam?p=${chaveSefaz}`,
      "PB": `http://www.receita.pb.gov.br/nfce?p=${chaveSefaz}`,
      "PE": `http://nfce.sefaz.pe.gov.br/nfce-web/consultarNFCe?p=${chaveSefaz}`,
      "PI": `https://webas.sefaz.pi.gov.br/nfceweb/consultarNFCe.jsf?p=${chaveSefaz}`,
      "PR": `http://www.fazenda.pr.gov.br/nfce/consulta?p=${chaveSefaz}`,
      "RJ": `http://www4.fazenda.rj.gov.br/consultaNFCe/paginas/consultaChaveAcesso.faces?p=${chaveSefaz}`,
      "RN": `http://nfce.set.rn.gov.br/consultarNFCe.aspx?p=${chaveSefaz}`,
      "RO": `http://www.nfce.sefin.ro.gov.br/consultanfce/consulta.jsp?p=${chaveSefaz}`,
      "RR": `http://www.sefaz.rr.gov.br/nfce/consulta?p=${chaveSefaz}`,
      "RS": `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${chaveSefaz}`,
      "SC": `https://sat.sef.sc.gov.br/tax.NET/sat.nfe.web/consulta_publica_nfe.aspx?p=${chaveSefaz}`,
      "SE": `http://www.nfce.se.gov.br/portal/consultarNFCe.jsp?p=${chaveSefaz}`,
      "SP": `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${chaveSefaz}`,
      "TO": `http://www.sefaz.to.gov.br/nfce/consulta.jsf?p=${chaveSefaz}`
    };

    const urlBase = urlsSefaz[estadoSefaz] || `https://www.sefaz.${estadoSefaz.toLowerCase()}.gov.br/nfce/consulta?p=${chaveSefaz}`;
    setUrlSefazWebView(urlBase); // Abre o navegador interno
  };

  // 🔥 3. FUNÇÃO QUE RECEBE O HTML DO WEBVIEW E PROCESSA NA IA
  const processarHtmlExtraido = async (html: string) => {
    setUrlSefazWebView(null); // Fecha o navegador
    setLoadingIA(true);
    setStatusIA("A Inteligência Artificial está lendo a nota...");

    try {
      const json = await extrairNotaDaSefaz(html);
      
      if(json && json.itens && json.itens.length > 0) {
        await adicionarVariosItens(json.itens);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Importação Concluída!", `${json.itens.length} itens do ${json.mercado || 'mercado'} foram adicionados ao carrinho.`);
        
        // Limpar os campos do Modal
        setChaveSefaz(""); setNfeSefaz(""); setSerieSefaz("");
        setEmissaoSefaz(""); setProtocoloSefaz(""); setDataAutSefaz("");
        router.replace("/");
      } else {
        Alert.alert("Tente de Novo", "Não foi possível encontrar os produtos. Certifique-se de clicar em 'Extrair Produtos' apenas quando a lista de itens estiver visível no ecrã.");
      }
    } catch(e) {
      Alert.alert("Erro", "Falha ao processar os dados extraídos.");
    } finally {
      setLoadingIA(false);
    }
  };

  if (!permission && loading) return <View style={styles.center}><ActivityIndicator size="large" color={color.tint} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.tituloTela}>Ajustes & Orçamento</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
          {/* PERFIL E FAMÍLIA */}
          <View style={styles.perfilCard}>
            <Image source={{ uri: usuario?.foto }} style={styles.fotoPerfil} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nomeUsuario}>{usuario?.nome}</Text>
              <Text style={styles.emailUsuario}>{usuario?.email}</Text>
            </View>
          </View>

          <View style={styles.cardInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Ionicons name="home" size={24} color={color.tint} />
              <Text style={styles.tituloSecao}>
                Código da Família: <Text style={{ fontWeight: "900" }}>{familiaId}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.btnDangerOutline}
              onPress={() => {
                Alert.alert("Sair da Família", "Tem a certeza que deseja sair?", [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Sair", style: "destructive", onPress: () => { sairDaFamilia(); useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); } },
                ]);
              }}
            >
              <Text style={styles.textDanger}>Sair desta Família</Text>
            </TouchableOpacity>
          </View>

          {/* SESSÃO IMPORTAÇÃO SEFAZ OFICIAL */}
          <Text style={styles.labelGrupo}>IMPORTAÇÃO DE NOTAS (NFC-e)</Text>
          <View style={[styles.cardEstatistica, { borderColor: '#10B981', borderWidth: 2 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Ionicons name="receipt" size={24} color="#10B981" />
              <Text style={styles.tituloSecao}>Portal SEFAZ Brasil</Text>
            </View>
            <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>
              O sistema abrirá o site do governo. Se for pedido um Captcha, resolva-o, e quando vir a nota, clique em Extrair!
            </Text>
            
            <TouchableOpacity 
              style={[styles.btnAcao, { backgroundColor: '#10B981', borderColor: '#10B981' }]} 
              onPress={() => { requestPermission(); setScannerSefazAtivo(true); }}
            >
              <View style={styles.btnAcaoLadoEsq}>
                <Ionicons name="qr-code-outline" size={24} color="white" />
                <Text style={[styles.textoBtnAcao, { color: 'white', fontWeight: 'bold' }]}>Ler QR Code da Nota</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnAcao, { marginBottom: 0 }]} onPress={() => { Haptics.selectionAsync(); setModalSefazManual(true); }}>
              <View style={styles.btnAcaoLadoEsq}>
                <Ionicons name="keypad" size={24} color={color.info} />
                <Text style={styles.textoBtnAcao}>Digitar Dados Manualmente</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* SEÇÃO DE ORÇAMENTO */}
          <Text style={styles.labelGrupo}>CONTROLE DE ORÇAMENTO</Text>
          <View style={styles.cardEstatistica}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="pie-chart" size={24} color={color.tint} />
                <Text style={styles.tituloSecao}>Limites por Categoria</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {salvandoOrcamento && <ActivityIndicator size="small" color={color.tint} style={{ marginRight: 10 }} />}
                <TouchableOpacity onPress={pedirSugestaoOrcamento}>
                  <Ionicons name="sparkles" size={24} color="#FFC857" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ color: color.textSecondary, fontSize: 13, marginBottom: 16, lineHeight: 18 }}>Defina um limite de gastos. Peça a sugestão da IA para metas baseadas no seu histórico.</Text>

            {CATEGORIAS.map((cat) => (
              <View key={cat} style={styles.linhaOrcamento}>
                <Text style={styles.textoCatOrcamento}>{cat}</Text>
                <View style={styles.inputContainerOrcamento}>
                  <Text style={{ color: color.textSecondary, marginRight: 4 }}>R$</Text>
                  <TextInput style={styles.inputOrcamento} keyboardType="numeric" placeholder="0,00" placeholderTextColor={color.borderDark} value={orcamentos[cat] || ""} onChangeText={(val) => atualizarOrcamento(cat, val)} />
                </View>
              </View>
            ))}
          </View>

          {/* DADOS VITAIS */}
          <Text style={styles.labelGrupo}>ESTATÍSTICAS VITAIS</Text>
          <View style={styles.cardEstatistica}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Ionicons name="stats-chart" size={24} color="#FFC857" />
              <Text style={styles.tituloSecao}>Seu Histórico Vitalício</Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Dinheiro Movimentado:</Text>
              <Text style={[styles.valorEstatistica, { color: color.tint }]}>R$ {stats.totalGastoVida.toFixed(2)}</Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Produtos Comprados:</Text>
              <Text style={styles.valorEstatistica}>{stats.totalItensVida} itens</Text>
            </View>
            <View style={styles.linhaEstatistica}>
              <Text style={styles.labelEstatistica}>Seção favorita:</Text>
              <Text style={styles.valorEstatistica}>{stats.categoriaFavorita}</Text>
            </View>
          </View>

          <Text style={styles.labelGrupo}>DADOS E PRIVACIDADE</Text>
          <TouchableOpacity style={styles.btnAcao} onPress={exportarDados}>
            <View style={styles.btnAcaoLadoEsq}>
              <Ionicons name="download-outline" size={22} color={color.info} />
              <Text style={styles.textoBtnAcao}>Exportar Compras (CSV)</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={color.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAcaoDanger} onPress={resetarBancoDeDados}>
            <View style={styles.btnAcaoLadoEsq}>
              <Ionicons name="warning-outline" size={22} color={color.danger} />
              <Text style={styles.textoBtnDanger}>Zerar Banco de Dados</Text>
            </View>
          </TouchableOpacity>

          {/* TEMA DO APLICATIVO */}
          <Text style={styles.labelGrupo}>APARÊNCIA DO APP</Text>
          <View style={styles.themeContainer}>
            <TouchableOpacity style={[styles.themeBtn, temaAtivo === "light" && styles.themeBtnActive]} onPress={() => mudarTema("light")}>
              <Ionicons name="sunny" size={24} color={temaAtivo === "light" ? color.tint : color.textSecondary} />
              <Text style={[styles.themeText, temaAtivo === "light" && styles.themeTextActive]}>Claro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.themeBtn, temaAtivo === "dark" && styles.themeBtnActive]} onPress={() => mudarTema("dark")}>
              <Ionicons name="moon" size={24} color={temaAtivo === "dark" ? color.tint : color.textSecondary} />
              <Text style={[styles.themeText, temaAtivo === "dark" && styles.themeTextActive]}>Escuro</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.themeBtn, temaAtivo === "system" && styles.themeBtnActive]} onPress={() => mudarTema("system")}>
              <Ionicons name="phone-portrait" size={24} color={temaAtivo === "system" ? color.tint : color.textSecondary} />
              <Text style={[styles.themeText, temaAtivo === "system" && styles.themeTextActive]}>Sistema</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.btnLogout}
            onPress={() => {
              Alert.alert("Terminar Sessão", "Deseja realmente sair da sua conta?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", style: "destructive", onPress: () => { fazerLogout(); useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); } },
              ]);
            }}
          >
            <Ionicons name="log-out" size={24} color="white" />
            <Text style={{ color: "white", fontWeight: "bold", marginLeft: 10, fontSize: 16 }}>Terminar Sessão</Text>
          </TouchableOpacity>

          <View style={styles.footerApp}>
            <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>Dehouse App</Text>
            <Text style={{ color: color.borderDark, fontSize: 12, marginTop: 4 }}>Versão 1.0.1 • Inteligência Local</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL SCANNER SEFAZ */}
      {scannerSefazAtivo && (
        <Modal visible={true} transparent={false} animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={processarSefazScan} />
            <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }} pointerEvents="box-none">
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 20 }}>
                <TouchableOpacity onPress={() => setScannerSefazAtivo(false)}>
                  <Ionicons name="close-circle" size={40} color="white" />
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center', marginBottom: 50 }}>
                <View style={styles.miraQrCode}>
                  <Ionicons name="qr-code-outline" size={80} color="#10B981" />
                </View>
                <Text style={{ color: 'white', fontWeight: 'bold', marginTop: 20, fontSize: 16 }}>Aponte para o QR Code da Sefaz</Text>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* MODAL DIGITAÇÃO MANUAL SEFAZ */}
      <Modal visible={modalSefazManual} transparent={true} animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalBackdrop}>
          <View style={styles.modalContentCentral}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              
              <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: color.text }}>Consulta Manual Sefaz</Text>
                <TouchableOpacity onPress={() => setModalSefazManual(false)}>
                  <Ionicons name="close-circle" size={28} color={color.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={{ width: '100%', marginBottom: 20 }}>
                <Text style={styles.labelInputManual}>Selecione o seu Estado (UF)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {UFS.map((uf) => (
                    <TouchableOpacity 
                      key={uf}
                      style={[styles.btnEstado, estadoSefaz === uf ? { backgroundColor: color.tint, borderColor: color.tint } : { backgroundColor: color.background, borderColor: color.border }, { marginRight: 8, paddingHorizontal: 16, paddingVertical: 10 }]} 
                      onPress={() => { Haptics.selectionAsync(); setEstadoSefaz(uf); }}
                    >
                      <Text style={[styles.textoBtnEstado, estadoSefaz === uf && { color: 'white' }]}>{uf}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.labelInputManual}>Chave de Acesso (44 números)*</Text>
              <TextInput style={styles.inputModalManual} placeholder="0000 0000 0000..." placeholderTextColor={color.borderDark} keyboardType="numeric" maxLength={44} value={chaveSefaz} onChangeText={setChaveSefaz} />

              <TouchableOpacity style={[styles.btnConfirmarDep, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={processarSefazManual}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="search" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Aceder à SEFAZ</Text>
                </View>
              </TouchableOpacity>
              
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 🔥 NOVO: MODAL NAVEGADOR WEBVIEW (CONTORNO DO CAPTCHA) */}
      {urlSefazWebView !== null && (
        <Modal visible={true} animationType="slide" transparent={false}>
          <SafeAreaView style={{ flex: 1, backgroundColor: color.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: color.card, borderBottomWidth: 1, borderColor: color.border }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: color.text }}>Navegador SEFAZ</Text>
              <TouchableOpacity onPress={() => setUrlSefazWebView(null)}>
                <Ionicons name="close-circle" size={32} color={color.danger} />
              </TouchableOpacity>
            </View>
            
            <View style={{ padding: 10, backgroundColor: color.warning + '20' }}>
              <Text style={{ color: color.warning, fontSize: 13, textAlign: 'center', fontWeight: 'bold' }}>
                Resolva o Captcha se for pedido. Quando vir a lista de produtos, clique no botão verde abaixo!
              </Text>
            </View>

            <WebView
              ref={webViewRef}
              source={{ uri: urlSefazWebView }}
              onMessage={(event) => processarHtmlExtraido(event.nativeEvent.data)}
              startInLoadingState={true}
              renderLoading={() => <ActivityIndicator size="large" color="#10B981" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18 }} />}
            />

            {/* BOTÃO MÁGICO PARA EXTRAIR O CÓDIGO HTML */}
            <TouchableOpacity 
              style={styles.btnExtrairFlutuante} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                // Injeta um JavaScript que pega no HTML da página e manda para a nossa app
                webViewRef.current?.injectJavaScript('window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); true;');
              }}
            >
              <Ionicons name="download" size={24} color="white" style={{ marginRight: 8 }} />
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Extrair Produtos Desta Tela</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}

      {/* MODAL LOADING IA */}
      <Modal visible={loadingIA} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="server" size={50} color="#10B981" style={{ marginBottom: 20 }} />
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18, marginTop: 20, textAlign: 'center', paddingHorizontal: 20 }}>
            {statusIA}
          </Text>
        </View>
      </Modal>
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
    themeText: { marginTop: 6, fontSize: 13, color: c.textSecondary, fontWeight: "600" },
    themeTextActive: { color: c.tint, fontWeight: "bold" },

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
    btnAcao: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
    btnAcaoLadoEsq: { flexDirection: "row", alignItems: "center", gap: 12 },
    textoBtnAcao: { color: c.text, fontWeight: "600", fontSize: 15 },
    btnAcaoDanger: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: c.danger },
    textoBtnDanger: { color: c.danger, fontWeight: "600", fontSize: 15 },

    btnLogout: { backgroundColor: c.danger, padding: 18, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center", elevation: 2, marginTop: 10 },

    footerApp: { alignItems: "center", marginTop: 40, opacity: 0.5 },
    
    miraQrCode: { padding: 30, borderWidth: 4, borderColor: '#10B981', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20, paddingVertical: 40 },
    modalContentCentral: { backgroundColor: c.card, borderRadius: 24, padding: 24, alignItems: "center", width: '100%', maxHeight: '90%' },
    btnEstado: { alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.border },
    textoBtnEstado: { color: c.textSecondary, fontWeight: 'bold' },
    labelInputManual: { fontSize: 12, fontWeight: "bold", color: c.textSecondary, marginBottom: 6, marginLeft: 4 },
    inputModalManual: { backgroundColor: c.background, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 15, color: c.text, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
    btnConfirmarDep: { width: "100%", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
    
    // ESTILO DO BOTÃO FLUTUANTE DA SEFAZ
    btnExtrairFlutuante: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#10B981', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, flexDirection: 'row', alignItems: 'center' }
  });