import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Audio } from "expo-av"; 
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

// 🔥 IMPORTAÇÃO PARA AS NOTIFICAÇÕES LOCAIS
import * as Notifications from "expo-notifications";

import { CalculadoraModal } from "../../components/CalculadoraModal";
import { Colors } from "../../constants/Colors";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore";

import { Produto, PrecoAnterior } from "../../types";
import { buscarNaInternet, comprimirImagem } from "../../services/apiService"; 
import { checarPrecoAnterior, processarCompra } from "../../services/dbService";
import { CarrinhoItem } from "../../components/CarrinhoItem";
import { getStyles } from "../../styles/homeStyles";

import { MercadoModal } from "../../components/modals/MercadoModal";
import { RecargaModal } from "../../components/modals/RecargaModal";
import { ProdutoModal } from "../../components/modals/ProdutoModal";
import { CameraModal } from "../../components/modals/CameraModal"; 
import { FotoAmpliadaModal } from "../../components/modals/FotoAmpliadaModal"; 

import { OnboardingModal } from "../../components/modals/OnboardingModal"; 
import { HistoricoBuscaModal } from "../../components/modals/HistoricoBuscaModal"; 

// Configuração para exibir a notificação mesmo com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DIAS_SEMANA = [
  { id: 1, nome: "Dom" }, { id: 2, nome: "Seg" }, { id: 3, nome: "Ter" },
  { id: 4, nome: "Qua" }, { id: 5, nome: "Qui" }, { id: 6, nome: "Sex" }, { id: 7, nome: "Sáb" }
];

export default function HomeScreen() {
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);

  const { usuario, familiaId, gerarNovaFamilia, setFamiliaId, fazerLogout, entrarNaFamiliaComSenha, criarNovaFamiliaComSenha } = useAuthStore();
  
  const [codigoInput, setCodigoInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [senhaInput, setSenhaInput] = useState("");

  const [senhaFamiliaEntrar, setSenhaFamiliaEntrar] = useState("");
  const [senhaFamiliaCriar, setSenhaFamiliaCriar] = useState("");
  const [loadingFamilia, setLoadingFamilia] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);

  const scannerRef = useRef<any>(null);
  const cameraShotRef = useRef<any>(null);

  const { saldo, carrinho, adicionarItem, removerItem, limparCarrinho, getTotal, sincronizarComNuvem, atualizarSaldoBanco } = useCartStore();
  const total = getTotal();

  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [scannerPronto, setScannerPronto] = useState(false);
  
  const [flashLigado, setFlashLigado] = useState(false);
  const [travaScanner, setTravaScanner] = useState(false);
  const [modoRapido, setModoRapido] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalRecargaVisivel, setModalRecargaVisivel] = useState(false);
  const [valorRecarga, setValorRecarga] = useState("");
  const [tipoOperacaoCarteira, setTipoOperacaoCarteira] = useState<"adicionar" | "remover">("adicionar");

  const [modalMercadoVisivel, setModalMercadoVisivel] = useState(false);
  const [nomeMercado, setNomeMercado] = useState("");

  const [salvandoBanco, setSalvandoBanco] = useState(false);
  const [statusSalvamento, setStatusSalvamento] = useState("");
  const [alertaDisparado, setAlertaDisparado] = useState(false);
  const [temSyncPendente, setTemSyncPendente] = useState(false);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState<Produto>({ id: "", barras: "", nome: "", preco: "", qtd: "1", categoria: "Alimentação" });
  const [editando, setEditando] = useState(false);
  const [precoAnterior, setPrecoAnterior] = useState<PrecoAnterior | null>(null);

  const [modalCalcVisivel, setModalCalcVisivel] = useState(false);

  // 🔥 ESTADO DO NOVO MODAL
  const [modalHistoricoVisivel, setModalHistoricoVisivel] = useState(false);

  const [fotoProduto, setFotoProduto] = useState<{ uri: string } | null>(null);
  const [fotoEtiqueta, setFotoEtiqueta] = useState<{ uri: string } | null>(null);
  const [modoTirarFoto, setModoTirarFoto] = useState<"produto" | "etiqueta" | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const [mostrarTutorial, setMostrarTutorial] = useState(false);

  // 🔥 ESTADOS PARA O LEMBRETE PERSONALIZADO
  const [modalNotificacaoVisivel, setModalNotificacaoVisivel] = useState(false);
  const [diaNotificacao, setDiaNotificacao] = useState(6); // Padrão: Sexta (6)
  const [horaNotificacao, setHoraNotificacao] = useState("17"); // Padrão: 17h
  const [modalAjudaVisivel, setModalAjudaVisivel] = useState(false);

  // 🔥 LÓGICA DE CARREGAMENTO DAS NOTIFICAÇÕES
  useEffect(() => {
    const carregarNotificacoes = async () => {
      const savedDia = await AsyncStorage.getItem('@dehouse_notificacao_dia');
      const savedHora = await AsyncStorage.getItem('@dehouse_notificacao_hora');
      
      let dia = savedDia ? parseInt(savedDia) : 6;
      let hora = savedHora ? parseInt(savedHora) : 17;
      
      setDiaNotificacao(dia);
      setHoraNotificacao(hora.toString().padStart(2, '0'));

      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted' && (!savedDia || !savedHora)) {
        agendarNotificacao(dia, hora);
      }
    };
    carregarNotificacoes();
  }, []);

  // 🔥 FUNÇÃO QUE AGENDA NO CELULAR DO USUÁRIO
  const agendarNotificacao = async (dia: number, hora: number) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Mercado a caminho? 🛒",
        body: "Já definiu o seu orçamento no Dehouse? Planeje sua lista agora mesmo e evite surpresas no caixa!",
        sound: true,
      },
      trigger: {
        weekday: dia,
        hour: hora,
        minute: 0,
        repeats: true,
      },
    });
  };

  // 🔥 SALVAR A PREFERÊNCIA DO USUÁRIO
  const salvarLembretePersonalizado = async () => {
    const horaInt = parseInt(horaNotificacao);
    if (isNaN(horaInt) || horaInt < 0 || horaInt > 23) {
      Alert.alert("Hora Inválida", "Digite uma hora válida entre 00 e 23.");
      return;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permissão Negada", "Precisamos de permissão para enviar lembretes.");
      return;
    }

    await AsyncStorage.setItem('@dehouse_notificacao_dia', diaNotificacao.toString());
    await AsyncStorage.setItem('@dehouse_notificacao_hora', horaInt.toString());
    await agendarNotificacao(diaNotificacao, horaInt);
    
    setModalNotificacaoVisivel(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Lembrete Ativado!", `Avisaremos você toda semana às ${horaInt.toString().padStart(2, '0')}h.`);
  };

  useEffect(() => {
    async function checarPermissaoMic() {
      const { granted } = await Audio.getPermissionsAsync();
      setMicPermissionGranted(granted);
    }
    checarPermissaoMic();
  }, []);

  useEffect(() => {
    const checarTutorial = async () => {
      if (familiaId) {
        const visto = await AsyncStorage.getItem("@dehouse_tutorial_visto");
        if (!visto) {
          setMostrarTutorial(true);
        }
      }
    };
    checarTutorial();
  }, [familiaId]);

  const pedirPermissoesDoSistema = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const cameraRes = await requestCameraPermission();
    const micRes = await Audio.requestPermissionsAsync();
    setMicPermissionGranted(micRes.granted);

    if (!cameraRes.granted || !micRes.granted) {
      Alert.alert("Aviso Importante", "Para usares as funções de Voz e Escaneamento de Barras, o aplicativo necessita destas permissões.");
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (familiaId) sincronizarComNuvem();
    }, [familiaId]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await sincronizarComNuvem();
    setRefreshing(false);
  };

  const fecharModalCadastro = () => {
    Keyboard.dismiss();
    setModalVisivel(false);
  };

  const compartilharCarrinho = async () => {
    if (carrinho.length === 0) return;
    Haptics.selectionAsync();
    let textoMensagem = `🛒 *Lista de Compras de ${usuario?.nome}*\n\n`;
    carrinho.forEach((item: any) => {
      const preco = parseFloat(item.preco?.replace(",", ".") || "0");
      const qtd = parseFloat(item.qtd?.replace(",", ".") || "1");
      const subtotal = (preco * qtd).toFixed(2);
      const sufixo = String(item.qtd).includes(".") || String(item.qtd).includes(",") ? "kg" : "x";
      textoMensagem += `▪️ ${item.qtd}${sufixo} ${item.nome} - R$ ${subtotal}\n`;
    });
    textoMensagem += `\n💰 *Total Previsto: R$ ${total.toFixed(2)}*`;
    try { await Share.share({ message: textoMensagem, title: "Minha Lista Dehouse" }); } catch (error) {}
  };

  const editarItem = (item: Produto) => {
    Haptics.selectionAsync();
    setEditando(true);
    setPrecoAnterior(null);

    setProdutoAtual({
      id: String(item.id || ""), barras: String(item.barras || ""), nome: String(item.nome || ""),
      preco: String(item.preco || ""), qtd: String(item.qtd || "1"), categoria: String(item.categoria || "Alimentação"),
    });

    setFotoProduto(item.fotoProdutoUri ? { uri: item.fotoProdutoUri } : null);
    setFotoEtiqueta(item.fotoEtiquetaUri ? { uri: item.fotoEtiquetaUri } : null);

    if (item.barras) {
      checarPrecoAnterior(item.barras, familiaId || "").then((res) => { if (res) setPrecoAnterior(res); }).catch(() => {});
    }
    setModalVisivel(true);
  };

  const checarComprasPendentes = async () => {
    try {
      const pendentes = await AsyncStorage.getItem("compras_offline");
      if (pendentes) {
        setTemSyncPendente(true);
        const dadosPendentes = JSON.parse(pendentes);
        const itens = Array.isArray(dadosPendentes) ? dadosPendentes : dadosPendentes.carrinho;
        const mercado = dadosPendentes.mercado || "Desconhecido";

        await processarCompra(itens, mercado, familiaId);
        await AsyncStorage.removeItem("compras_offline");
        setTemSyncPendente(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setTemSyncPendente(false);
      }
    } catch (e) {
      setTemSyncPendente(true);
    }
  };

  useEffect(() => { checarComprasPendentes(); }, []);

  useEffect(() => {
    if (total > saldo && !alertaDisparado && total > 0 && saldo > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("⚠️ Saldo Estourado!", `O carrinho ultrapassou o seu saldo disponível.`);
      setAlertaDisparado(true);
    } else if (total <= saldo) setAlertaDisparado(false);
  }, [carrinho, saldo, total]);

  const gerenciarCarteira = async () => {
    const valStr = valorRecarga.replace(",", ".");
    const val = parseFloat(valStr);

    if (!val || val <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Valor Inválido", "Digite um valor válido.");
      return;
    }
    if (tipoOperacaoCarteira === "remover" && val > saldo) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Saldo Insuficiente", "Valor maior que o saldo atual.");
      return;
    }

    const novoSaldo = tipoOperacaoCarteira === "adicionar" ? saldo + val : saldo - val;
    await atualizarSaldoBanco(novoSaldo);
    setModalRecargaVisivel(false);
    setValorRecarga("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const adicionarManualmente = () => {
    Haptics.selectionAsync();
    setScannerAtivo(false); setEditando(false); setPrecoAnterior(null); setFlashLigado(false);
    setFotoProduto(null); setFotoEtiqueta(null); 
    setProdutoAtual({ id: Date.now().toString(), barras: "", nome: "", preco: "", qtd: "1", categoria: "Alimentação" });
    setModalVisivel(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (travaScanner || !scannerPronto) return;
    
    setTravaScanner(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (data.startsWith("http") || data.startsWith("https")) {
      setScannerAtivo(false); setFlashLigado(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Nota Fiscal Detectada", "Para importar Notas Fiscais, vá até a aba 'Ajustes' e abra a sua Gaveta de Notas.");
      setTimeout(() => setTravaScanner(false), 2000);
      return;
    }

    let nomePreenchido = "";
    let categoriaPreenchida = "Alimentação";

    const itemAntigo = await checarPrecoAnterior(data, familiaId || "");

    if (itemAntigo) {
      nomePreenchido = String(itemAntigo.nome_produto);
      categoriaPreenchida = String(itemAntigo.categoria);
      setPrecoAnterior(itemAntigo);
    } else {
      nomePreenchido = await buscarNaInternet(data);
    }

    if (modoRapido) {
      adicionarItem({ id: Date.now().toString(), barras: data, nome: nomePreenchido || "Produto Novo (Flash)", preco: "0", qtd: "1", categoria: categoriaPreenchida }, false);
      setTimeout(() => setTravaScanner(false), 1200);
      return;
    }

    setScannerAtivo(false); setEditando(false); setFlashLigado(false);
    setFotoProduto(null); setFotoEtiqueta(null); 
    setProdutoAtual({ id: Date.now().toString(), barras: data, nome: nomePreenchido, preco: "", qtd: "1", categoria: categoriaPreenchida });
    setModalVisivel(true);
    setTimeout(() => setTravaScanner(false), 2000);
  };

  const handleLimparCarrinho = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Esvaziar", "Deseja apagar todos os itens do carrinho?", [
      { text: "Cancelar", style: "cancel" }, { text: "Esvaziar", style: "destructive", onPress: limparCarrinho },
    ]);
  };

  const capturarFotoPelaCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (cameraShotRef.current && modoTirarFoto) {
      try {
        const photo = await cameraShotRef.current.takePictureAsync({ quality: 1 });
        const uriLeve = await comprimirImagem(photo.uri); 
        const fotoDados = { uri: uriLeve };

        if (modoTirarFoto === "produto") setFotoProduto(fotoDados);
        else setFotoEtiqueta(fotoDados);
        
        setModoTirarFoto(null); setFlashLigado(false);
      } catch (e) {
        Alert.alert("Erro", "Não foi possível tirar a foto."); setModoTirarFoto(null);
      }
    }
  };

  const salvarNoCarrinho = () => {
    if (!produtoAtual.nome || !produtoAtual.preco) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Faltam Dados", "Preencha o nome e o preço.");
      return;
    }

    const itemPronto = { 
      ...produtoAtual, 
      fotoProdutoUri: fotoProduto?.uri || null, 
      fotoEtiquetaUri: fotoEtiqueta?.uri || null 
    };

    adicionarItem(itemPronto, editando);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    setModalVisivel(false);
  };

  const abrirFinalizacao = () => {
    const itensSemPreco = carrinho.filter((i: any) => parseFloat(i.preco?.replace(",", ".") || "0") === 0);
    if (itensSemPreco.length > 0) {
      Alert.alert("Itens sem preço!", "Você usou o Modo Rápido. Clique nos itens amarelos da lista e coloque o preço antes de finalizar.");
      return;
    }
    if (total > saldo) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Saldo Insuficiente", "Recarregue seu Cartão Dehouse.");
      return;
    }
    setModalMercadoVisivel(true);
  };

  const confirmarCompraFinal = async () => {
    if (!nomeMercado.trim()) { Alert.alert("Obrigatório", "Digite o nome do supermercado."); return; }

    setModalMercadoVisivel(false);
    if (salvandoBanco) return;
    setSalvandoBanco(true);

    try {
      setStatusSalvamento("Descontando saldo e salvando...");
      await processarCompra(carrinho as Produto[], nomeMercado, familiaId);

      const novoSaldo = saldo - total;
      await atualizarSaldoBanco(novoSaldo);
      await sincronizarComNuvem();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Tudo Certo!", "Compra finalizada e salva no seu histórico.");
      limparCarrinho(); setAlertaDisparado(false); setTemSyncPendente(false); setNomeMercado("");
    } catch (error) {
      await AsyncStorage.setItem("compras_offline", JSON.stringify({ carrinho: carrinho, mercado: nomeMercado }));
      setTemSyncPendente(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Sem Sinal 📶", "Sua compra foi salva no celular e será enviada à nuvem depois.");
      limparCarrinho(); setAlertaDisparado(false); setNomeMercado("");
    } finally {
      setSalvandoBanco(false); setStatusSalvamento("");
    }
  };

  if (!cameraPermission || micPermissionGranted === null) {
    return <View style={styles.center}><ActivityIndicator size="large" color={color.tint} /></View>;
  }

  if (!usuario) {
    return (
      <SafeAreaView style={[styles.center, { padding: 24, backgroundColor: color.background }]}>
        <Ionicons name="cart" size={80} color={color.tint} style={{ marginBottom: 20 }} />
        <Text style={{ fontSize: 32, fontWeight: "900", color: color.text, marginBottom: 10, textAlign: "center", letterSpacing: -1 }}>Dehouse Market</Text>
        <Text style={{ fontSize: 16, color: color.textSecondary, textAlign: "center", marginBottom: 40, paddingHorizontal: 20 }}>Organize compras, compare preços e gira o orçamento com a sua família.</Text>

        <View style={{ width: "100%", gap: 12, marginBottom: 30 }}>
          <TextInput style={styles.inputAuth} placeholder="O seu e-mail" placeholderTextColor={color.textSecondary} keyboardType="email-address" autoCapitalize="none" value={emailInput} onChangeText={setEmailInput} />
          <TextInput style={styles.inputAuth} placeholder="Palavra-passe" placeholderTextColor={color.textSecondary} secureTextEntry value={senhaInput} onChangeText={setSenhaInput} />
          <TouchableOpacity style={[styles.btnAdicionarCarrinho, { backgroundColor: color.tint, marginTop: 10, marginBottom: 0 }]} onPress={() => { Haptics.selectionAsync(); useAuthStore.getState().entrarOuRegistar(emailInput, senhaInput); }}>
            <Text style={styles.textoBotaoBranco}>Entrar / Registar</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", width: "100%", marginBottom: 30 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
          <Text style={{ color: color.textSecondary, paddingHorizontal: 16, fontSize: 12, fontWeight: "bold" }}>OU CONTINUE COM</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
        </View>

        <TouchableOpacity style={{ width: "100%", backgroundColor: color.card, padding: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color.border, elevation: 2 }} onPress={() => { Haptics.selectionAsync(); useAuthStore.getState().entrarComGoogle(); }}>
          <Ionicons name="logo-google" size={20} color={color.text} style={{ marginRight: 12 }} />
          <Text style={{ color: color.text, fontWeight: "bold", fontSize: 16 }}>Entrar com o Google</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!cameraPermission.granted || !micPermissionGranted) {
    return (
      <SafeAreaView style={[styles.center, { padding: 32, backgroundColor: color.background }]}>
        <View style={{ backgroundColor: color.card, padding: 24, borderRadius: 28, width: "100%", alignItems: "center", borderWidth: 1, borderColor: color.border, elevation: 4 }}>
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 20 }}>
            <Ionicons name="camera" size={40} color={color.tint} />
            <Ionicons name="mic" size={40} color={color.info} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: color.text, marginBottom: 12, textAlign: "center" }}>Permissões Necessárias</Text>
          <Text style={{ fontSize: 14, color: color.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
            Para usares o leitor de código de barras, anexar fotos aos teus recibos e adicionar produtos falando ao microfone, precisamos que atives os acessos nativos do sistema.
          </Text>
          
          <TouchableOpacity 
            style={[styles.btnAdicionarCarrinho, { backgroundColor: color.tint, width: "100%", marginBottom: 0 }]} 
            onPress={pedirPermissoesDoSistema}
          >
            <Text style={styles.textoBotaoBranco}>Ativar Câmera e Microfone</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!familiaId) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingVertical: 40, alignItems: 'center' }} style={{ backgroundColor: color.background, flex: 1 }}>
        <Image source={{ uri: usuario.foto }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16, borderWidth: 3, borderColor: color.tint }} contentFit="cover" transition={300} />
        <Text style={{ fontSize: 24, fontWeight: "bold", color: color.text, marginBottom: 10, textAlign: "center" }}>Olá, {usuario.nome}!</Text>
        <Text style={{ fontSize: 15, color: color.textSecondary, textAlign: "center", marginBottom: 30 }}>Para partilhares compras e o teu histórico em tempo real, precisas de criar uma família ou entrar numa existente.</Text>
        
        <View style={{ width: "100%", backgroundColor: color.card, padding: 20, borderRadius: 24, elevation: 2, borderWidth: 1, borderColor: color.border, marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: color.text, marginBottom: 12 }}>Juntar-se a uma Família</Text>
          <TextInput style={[styles.inputAuth, { marginBottom: 10, textAlign: "center", letterSpacing: 4, fontWeight: "bold" }]} placeholder="CÓDIGO (Ex: A8X9P)" placeholderTextColor={color.textSecondary} value={codigoInput} autoCapitalize="characters" onChangeText={setCodigoInput} />
          <TextInput style={[styles.inputAuth, { marginBottom: 16, textAlign: "center" }]} placeholder="Palavra-passe (se houver)" placeholderTextColor={color.textSecondary} secureTextEntry value={senhaFamiliaEntrar} onChangeText={setSenhaFamiliaEntrar} />
          
          <TouchableOpacity 
            style={[styles.btnAdicionarCarrinho, { backgroundColor: color.info, marginBottom: 0 }]} 
            onPress={async () => { 
              const codigoTratado = codigoInput.trim().toUpperCase();
              if (codigoTratado.length < 4) return Alert.alert("Erro", "Código inválido."); 
              
              setLoadingFamilia(true);
              const sucesso = await entrarNaFamiliaComSenha(codigoTratado, senhaFamiliaEntrar);
              setLoadingFamilia(false);
              
              if (sucesso) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
                setCodigoInput(""); setSenhaFamiliaEntrar("");
              }
            }}
          >
            {loadingFamilia ? <ActivityIndicator color="white" /> : <Text style={styles.textoBotaoBranco}>Entrar na Família</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ width: "100%", backgroundColor: color.card, padding: 20, borderRadius: 24, elevation: 2, borderWidth: 1, borderColor: color.border }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: color.text, marginBottom: 12 }}>Criar a Minha Família</Text>
          <TextInput style={[styles.inputAuth, { marginBottom: 16, textAlign: "center" }]} placeholder="Criar palavra-passe (Opcional)" placeholderTextColor={color.textSecondary} secureTextEntry value={senhaFamiliaCriar} onChangeText={setSenhaFamiliaCriar} />
          
          <TouchableOpacity 
            style={[styles.btnAdicionarCarrinho, { backgroundColor: color.tint, marginBottom: 0 }]} 
            onPress={async () => { 
              setLoadingFamilia(true);
              const sucesso = await criarNovaFamiliaComSenha(senhaFamiliaCriar);
              setLoadingFamilia(false);
              
              if (sucesso) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
                setSenhaFamiliaCriar("");
              }
            }}
          >
            {loadingFamilia ? <ActivityIndicator color="white" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="add-circle" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={styles.textoBotaoBranco}>Criar e Receber Código</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const porcentagemGasta = saldo > 0 ? (total / saldo) * 100 : 0;
  const corProgresso = total > saldo ? color.danger : porcentagemGasta > 80 ? color.warning : color.tint;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerPerfil}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={{ uri: usuario?.foto }} style={styles.fotoPerfilMin} contentFit="cover" transition={300} />
          <View>
            <Text style={styles.boasVindas}>Olá, {usuario?.nome}</Text>
            <TouchableOpacity style={styles.pillFamilia} onPress={() => Share.share({ message: `Participe da minha família no Dehouse usando o código: ${familiaId}` })}>
              <Text style={styles.textoPillFamilia}>Família: {familiaId}</Text>
              <Ionicons name="share-social" size={12} color={color.tint} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* 🔥 CABEÇALHO COM O BOTÃO DE AJUDA, SINO E SAIR */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color.tint + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}
            onPress={() => { Haptics.selectionAsync(); setModalAjudaVisivel(true); }}
          >
            <Ionicons name="help-buoy" size={18} color={color.tint} />
            <Text style={{ color: color.tint, fontWeight: 'bold', marginLeft: 4, fontSize: 13 }}>Ajuda</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setModalNotificacaoVisivel(true); }}>
            <Ionicons name="notifications-outline" size={26} color={color.tint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { Alert.alert("Terminar Sessão", "Deseja sair da sua conta?", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: () => { fazerLogout(); useCartStore.setState({ carrinho: [], historico: [], saldo: 0 }); } }]); }}>
            <Ionicons name="log-out-outline" size={26} color={color.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.walletCard, { marginTop: 12 }]}>
        <View style={styles.walletHeader}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="card" size={24} color="#FFC857" />
            <Text style={styles.walletTitle}>Cartão Dehouse</Text>
            <TouchableOpacity onPress={checarComprasPendentes} style={{ marginLeft: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="cloud-upload" size={24} color={temSyncPendente ? color.warning : "transparent"} />
              {temSyncPendente && <View style={[styles.pontoNuvem, { right: -2, top: -2 }]} />}
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTipoOperacaoCarteira("remover"); setModalRecargaVisivel(true); }} style={styles.btnRemover}>
              <Ionicons name="remove-circle" size={16} color={color.danger} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setTipoOperacaoCarteira("adicionar"); setModalRecargaVisivel(true); }} style={styles.btnRecarga}>
              <Ionicons name="add-circle" size={16} color="white" />
              <Text style={styles.textoBtnRecarga}>Recarregar</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.labelSaldo}>Saldo Após a Compra</Text>
        <Text style={[styles.valorSaldo, { color: total > saldo ? color.danger : color.text }]}>R$ {(saldo - total).toFixed(2)}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>No Carrinho: R$ {total.toFixed(2)}</Text>
          <Text style={styles.infoText}>Saldo Atual: R$ {saldo.toFixed(2)}</Text>
        </View>
        <View style={styles.barraFundo}>
          <View style={[styles.barraProgresso, { width: `${Math.min(porcentagemGasta, 100)}%`, backgroundColor: corProgresso }]} />
        </View>
      </View>

      {!scannerAtivo ? (
        <View>
          <View style={styles.botoesAcaoContainer}>
            <TouchableOpacity 
              style={styles.btnAcaoScan} 
              onPress={() => { 
                Haptics.selectionAsync(); 
                setScannerAtivo(true); 
                setScannerPronto(false);
                setTimeout(() => {
                  setScannerPronto(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }, 1500);
              }}
            >
              <Ionicons name="barcode-outline" size={24} color="white" />
              <Text style={styles.textoBotaoAcaoBranco}>Escanear Código</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAcaoManual} onPress={adicionarManualmente}>
              <Ionicons name="create-outline" size={24} color={color.info} />
              <Text style={styles.textoBotaoAcaoAzul}>Digitar Manual</Text>
            </TouchableOpacity>
          </View>

          {/* 🔥 NOVO BOTÃO DE DETETIVE DE PREÇOS */}
          <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: color.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: color.border, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }} 
              onPress={() => { Haptics.selectionAsync(); setModalHistoricoVisivel(true); }}
            >
              <Ionicons name="search" size={22} color={color.tint} style={{ marginRight: 8 }} />
              <Text style={{ color: color.text, fontWeight: "bold", fontSize: 16 }}>Detetive de Preços (Histórico)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" enableTorch={flashLigado} ref={modoTirarFoto ? cameraShotRef : scannerRef} onBarcodeScanned={modalVisivel || modoTirarFoto ? undefined : handleBarcodeScanned} />
          
          <View style={[StyleSheet.absoluteFillObject, styles.overlayScanner]} pointerEvents="box-none">
            <TouchableOpacity style={styles.btnLanterna} onPress={() => { Haptics.selectionAsync(); setFlashLigado(!flashLigado); }}>
              <Ionicons name={flashLigado ? "flash" : "flash-off"} size={28} color={flashLigado ? "#FFC857" : "white"} />
            </TouchableOpacity>
            
            {!modoTirarFoto && (
              <TouchableOpacity style={[styles.btnModoRapido, modoRapido && styles.btnModoRapidoAtivo]} onPress={() => { Haptics.selectionAsync(); setModoRapido(!modoRapido); }}>
                <Ionicons name="rocket" size={26} color={modoRapido ? "#FFC857" : "white"} />
                {modoRapido && <Text style={{ color: "#FFC857", fontWeight: "bold", fontSize: 12, marginTop: 4 }}>FLASH ON</Text>}
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.btnFecharScanner} onPress={() => { Haptics.selectionAsync(); setScannerAtivo(false); setFlashLigado(false); setModoRapido(false); setModoTirarFoto(null); }}>
              <Ionicons name="close-circle" size={36} color="white" />
            </TouchableOpacity>
            
            {!modoTirarFoto && (
              <View pointerEvents="none" style={styles.miraScanner}>
                <Ionicons name="scan-outline" size={100} color={scannerPronto ? (modoRapido ? "#FFC857" : "#10B981") : "rgba(255,255,255,0.3)"} />
                {!scannerPronto ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 16 }}>
                    <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
                    <Text style={{ color: "white", fontWeight: "bold" }}>Focando no código...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 16 }}>
                    <Text style={{ color: "white", fontWeight: "bold" }}>Pronto para Ler!</Text>
                  </View>
                )}
              </View>
            )}

          </View>
        </View>
      )}

      {/* 🔥 PADDING REDUZIDO NA LISTA POIS O BANNER AD FOI REMOVIDO */}
      <View style={styles.listaContainer}>
        <View style={styles.headerLista}>
          <Text style={styles.tituloSecao}>Itens Adicionados ({carrinho.length})</Text>
          {carrinho.length > 0 && (
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <TouchableOpacity onPress={compartilharCarrinho}><Ionicons name="share-outline" size={22} color={color.info} /></TouchableOpacity>
              <TouchableOpacity onPress={handleLimparCarrinho}><Text style={styles.btnLimparTexto}>Esvaziar</Text></TouchableOpacity>
            </View>
          )}
        </View>
        <FlatList
          data={carrinho}
          keyExtractor={(item: any) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => <CarrinhoItem item={item as Produto} styles={styles} color={color} onEditar={editarItem} onRemover={removerItem} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.tint} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cloud-done-outline" size={60} color={color.borderDark} />
              <Text style={styles.listaVazia}>Carrinho vazio. Puxe para sincronizar.</Text>
            </View>
          }
        />
      </View>

      {carrinho.length > 0 && (
        <View style={[styles.footerFloat, { zIndex: 2 }]}>
          <TouchableOpacity style={styles.btnFinalizar} onPress={abrirFinalizacao} disabled={salvandoBanco}>
            {salvandoBanco ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}><ActivityIndicator color="white" style={{ marginRight: 10 }} /><Text style={styles.textoBotaoBranco}>{statusSalvamento}</Text></View>
            ) : (
              <><Text style={styles.textoBotaoBranco}>Finalizar Compra</Text><Ionicons name="card" size={20} color="white" style={{ marginLeft: 8 }} /></>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!scannerAtivo && (
        <TouchableOpacity style={[styles.btnCalcFlutuante, { backgroundColor: theme === "dark" ? "#333" : "#1E1E1E" }]} onPress={() => { Haptics.selectionAsync(); setModalCalcVisivel(true); }}>
          <Ionicons name="calculator" size={24} color="#FFC857" />
        </TouchableOpacity>
      )}

      <MercadoModal visivel={modalMercadoVisivel} fecharModal={() => setModalMercadoVisivel(false)} nomeMercado={nomeMercado} setNomeMercado={setNomeMercado} confirmarCompra={confirmarCompraFinal} color={color} styles={styles} />
      <RecargaModal visivel={modalRecargaVisivel} fecharModal={() => { setModalRecargaVisivel(false); setValorRecarga(""); }} tipoOperacao={tipoOperacaoCarteira} valorRecarga={valorRecarga} setValorRecarga={setValorRecarga} confirmarRecarga={gerenciarCarteira} color={color} styles={styles} />
      
      <ProdutoModal visivel={modalVisivel} fecharModal={fecharModalCadastro} editando={editando} produtoAtual={produtoAtual} setProdutoAtual={setProdutoAtual} precoAnterior={precoAnterior} fotoProduto={fotoProduto} setFotoProduto={setFotoProduto} fotoEtiqueta={fotoEtiqueta} setFotoEtiqueta={setFotoEtiqueta} setFotoAmpliada={setFotoAmpliada} setModoTirarFoto={setModoTirarFoto} salvarNoCarrinho={salvarNoCarrinho} color={color} styles={styles} />
      <FotoAmpliadaModal fotoAmpliada={fotoAmpliada} setFotoAmpliada={setFotoAmpliada} />
      <CameraModal modoTirarFoto={modoTirarFoto} setModoTirarFoto={setModoTirarFoto} flashLigado={flashLigado} setFlashLigado={setFlashLigado} cameraShotRef={cameraShotRef} capturarFotoPelaCamera={capturarFotoPelaCamera} styles={styles} />
      
      <CalculadoraModal visivel={modalCalcVisivel} fecharModal={() => setModalCalcVisivel(false)} color={color} />
      
      <OnboardingModal visivel={mostrarTutorial} aoFechar={() => setMostrarTutorial(false)} color={color} />

      {/* 🔥 RENDENRIZANDO O MODAL DE BUSCA AQUI */}
      <HistoricoBuscaModal visivel={modalHistoricoVisivel} fecharModal={() => setModalHistoricoVisivel(false)} color={color} />

      {/* MODAL NOTIFICAÇÕES */}
      {modalNotificacaoVisivel && (
        <Modal visible={true} transparent={true} animationType="fade">
          <View style={localStyles.modalBackdrop}>
            <View style={[localStyles.modalCard, { backgroundColor: color.card, borderColor: color.border }]}>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: color.text }}>Lembrete Semanal</Text>
                <TouchableOpacity onPress={() => setModalNotificacaoVisivel(false)}>
                  <Ionicons name="close-circle" size={28} color={color.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: color.textSecondary, marginBottom: 20, fontSize: 14 }}>
                Escolha o dia e a hora em que você costuma ir ao mercado. Enviaremos um lembrete para planejar suas compras!
              </Text>

              <Text style={{ color: color.text, fontWeight: 'bold', marginBottom: 10 }}>Dia da Semana</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                {DIAS_SEMANA.map((dia) => (
                  <TouchableOpacity 
                    key={dia.id} 
                    style={[localStyles.pillDia, { backgroundColor: color.background, borderColor: color.border }, diaNotificacao === dia.id && { backgroundColor: color.tint, borderColor: color.tint }]}
                    onPress={() => { Haptics.selectionAsync(); setDiaNotificacao(dia.id); }}
                  >
                    <Text style={[localStyles.textoPillDia, { color: color.textSecondary }, diaNotificacao === dia.id && { color: 'white', fontWeight: 'bold' }]}>
                      {dia.nome}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={{ color: color.text, fontWeight: 'bold', marginBottom: 10 }}>Hora do Lembrete (00 a 23)</Text>
              <TextInput
                style={[localStyles.inputHora, { backgroundColor: color.background, color: color.text, borderColor: color.border }]}
                keyboardType="numeric"
                maxLength={2}
                placeholder="Ex: 17"
                placeholderTextColor={color.textSecondary}
                value={horaNotificacao}
                onChangeText={setHoraNotificacao}
              />

              <TouchableOpacity style={[localStyles.btnSalvar, { backgroundColor: color.tint }]} onPress={salvarLembretePersonalizado}>
                <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Salvar Lembrete</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      )}

      {/* 🔥 O NOVO MODAL "GUIA AMIGO" DA TELA INICIAL */}
      {modalAjudaVisivel && (
        <Modal visible={true} transparent={true} animationType="slide">
          <View style={localStyles.modalBackdrop}>
            <View style={[localStyles.modalCard, { backgroundColor: color.card, borderColor: color.border, padding: 0, overflow: 'hidden' }]}>
              
              <View style={{ backgroundColor: color.tint, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>Como usar esta tela?</Text>
                <TouchableOpacity onPress={() => setModalAjudaVisivel(false)}>
                  <Ionicons name="close-circle" size={28} color="white" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ padding: 20, maxHeight: 400 }}>
                
                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: '#FFC857' + '30' }]}>
                    <Ionicons name="card" size={28} color="#FFC857" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>O seu Cartão Dehouse</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>Clique em "Recarregar" para dizer ao aplicativo quanto dinheiro tem para gastar hoje. Ele vai avisar-lhe se a compra ficar muito cara!</Text>
                  </View>
                </View>

                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: color.info + '30' }]}>
                    <Ionicons name="barcode-outline" size={28} color={color.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>Escanear ou Digitar</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>Aponte a câmara para o código de barras de um produto para o aplicativo o reconhecer, ou clique em "Digitar Manual" para escrever você mesmo.</Text>
                  </View>
                </View>

                <View style={localStyles.helpItem}>
                  <View style={[localStyles.helpIconWrapper, { backgroundColor: color.tint + '30' }]}>
                    <Ionicons name="checkmark-circle" size={28} color={color.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[localStyles.helpTitle, { color: color.text }]}>Finalizar Compra</Text>
                    <Text style={{ color: color.textSecondary, fontSize: 13, lineHeight: 18 }}>Quando chegar à caixa do mercado, clique no grande botão verde em baixo para guardar todos estes produtos no seu Histórico Vitalício.</Text>
                  </View>
                </View>

              </ScrollView>

              <TouchableOpacity style={[localStyles.btnEntendi, { backgroundColor: color.background, borderTopColor: color.border, borderTopWidth: 1 }]} onPress={() => setModalAjudaVisivel(false)}>
                <Text style={{ color: color.tint, fontWeight: 'bold', fontSize: 16 }}>Entendi, obrigado!</Text>
              </TouchableOpacity>

            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}

// Estilos específicos para os modais locais para não quebrar a arquitetura
const localStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    width: '100%',
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  pillDia: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  textoPillDia: {
    fontSize: 14,
    fontWeight: '600'
  },
  inputHora: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: 'bold',
    width: 80,
    marginBottom: 24,
  },
  btnSalvar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  // Estilos do Guia Amigo
  helpItem: { 
    flexDirection: 'row', 
    marginBottom: 20, 
    alignItems: 'center' 
  },
  helpIconWrapper: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  helpTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  btnEntendi: { 
    padding: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  }
});