import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { useFocusEffect } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
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
import { CalculadoraModal } from "../../components/CalculadoraModal";
import { Colors } from "../../constants/Colors";
import { turso } from "../../database";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../../store/useCartStore";
import { useThemeStore } from "../../store/useThemeStore"; // 🔥 TEMA ADICIONADO AQUI

// ANÚNCIOS ATIVADOS AQUI!
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";

const IMGBB_API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
const CATEGORIAS = ["Alimentação", "Limpeza", "Higiene", "Bebidas", "Outros"];

// 🔥 NOVA FUNÇÃO MÁGICA DE COMPRESSÃO (FORA DO COMPONENTE)
const comprimirImagem = async (uriOriginal: string) => {
  try {
    const imagemComprimida = await ImageManipulator.manipulateAsync(
      uriOriginal,
      [{ resize: { width: 800 } }], // Reduz a largura para 800px (tamanho ideal)
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }, // Reduz qualidade em 30%
    );

    // Esta é a URI que fica super leve!
    return imagemComprimida.uri;
  } catch (error) {
    console.error("Erro ao comprimir:", error);
    return uriOriginal; // Se falhar, devolve a original por segurança
  }
};

export default function HomeScreen() {
  // 🔥 GESTÃO DE TEMA ATUALIZADA
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];
  const styles = useMemo(() => getStyles(color), [color]);

  // GESTÃO DE CONTA, PERFIL E FAMÍLIA
  const {
    usuario,
    setUsuario,
    familiaId,
    gerarNovaFamilia,
    setFamiliaId,
    sairDaFamilia,
    fazerLogout,
  } = useAuthStore();
  const [codigoInput, setCodigoInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [senhaInput, setSenhaInput] = useState("");

  const [permission, requestPermission] = useCameraPermissions();
  const scannerRef = useRef<any>(null);
  const cameraShotRef = useRef<any>(null);

  const {
    saldo,
    setSaldo,
    carrinho,
    adicionarItem,
    removerItem,
    limparCarrinho,
    getTotal,
    sincronizarComNuvem,
    atualizarSaldoBanco,
  } = useCartStore();
  const total = getTotal();

  const [scannerAtivo, setScannerAtivo] = useState(false);
  const [flashLigado, setFlashLigado] = useState(false);
  const [travaScanner, setTravaScanner] = useState(false);
  const [modoRapido, setModoRapido] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [modalRecargaVisivel, setModalRecargaVisivel] = useState(false);
  const [valorRecarga, setValorRecarga] = useState("");
  const [tipoOperacaoCarteira, setTipoOperacaoCarteira] = useState<
    "adicionar" | "remover"
  >("adicionar");

  const [modalMercadoVisivel, setModalMercadoVisivel] = useState(false);
  const [nomeMercado, setNomeMercado] = useState("");

  const [salvandoBanco, setSalvandoBanco] = useState(false);
  const [statusSalvamento, setStatusSalvamento] = useState("");
  const [alertaDisparado, setAlertaDisparado] = useState(false);
  const [temSyncPendente, setTemSyncPendente] = useState(false);

  const [modalVisivel, setModalVisivel] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState({
    id: "",
    barras: "",
    nome: "",
    preco: "",
    qtd: "1",
    categoria: "Alimentação",
  });
  const [editando, setEditando] = useState(false);
  const [precoAnterior, setPrecoAnterior] = useState<any>(null);

  const [fotoProduto, setFotoProduto] = useState<{ uri: string } | null>(null);
  const [fotoEtiqueta, setFotoEtiqueta] = useState<{ uri: string } | null>(
    null,
  );
  const [modoTirarFoto, setModoTirarFoto] = useState<
    "produto" | "etiqueta" | null
  >(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const [modalCalcVisivel, setModalCalcVisivel] = useState(false);

  const checarPrecoAnterior = async (codigo: string) => {
    try {
      const resultado = await turso.execute({
        sql: "SELECT preco_prateleira, mes_referencia, nome_produto, categoria FROM compras_historico WHERE codigo_barras = ? ORDER BY id DESC LIMIT 1",
        args: [codigo],
      });
      if (resultado.rows.length > 0) return resultado.rows[0];
      return null;
    } catch (e) {
      return null;
    }
  };

  const buscarNaInternet = async (codigo: string) => {
    setStatusSalvamento("Consultando...");
    try {
      const resOff = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${codigo}.json`,
      );
      const dadosOff = await resOff.json();
      if (dadosOff.status === 1 && dadosOff.product.product_name)
        return dadosOff.product.product_name;
    } catch (error) {}
    setStatusSalvamento("");
    return "";
  };

  const uploadImagemParaNuvem = async (fileUri: string) => {
    try {
      const data = new FormData();
      data.append("image", {
        uri: fileUri,
        name: "foto.jpg",
        type: "image/jpeg",
      } as any);
      const res = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
          method: "POST",
          body: data,
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      const json = await res.json();
      if (json.data && json.data.url) return json.data.url;
      return null;
    } catch (erro) {
      return null;
    }
  };

  const processarCompra = async (itensCarrinho: any[], mercadoNome: string) => {
    const dataAtual = new Date();
    const mesReferencia = `${String(dataAtual.getMonth() + 1).padStart(2, "0")}-${dataAtual.getFullYear()}`;

    try {
      await turso.execute(
        "ALTER TABLE compras_historico ADD COLUMN familia_id TEXT",
      );
    } catch (e) {}

    const carrinhoComLinks = await Promise.all(
      itensCarrinho.map(async (item) => {
        let linkProduto = item.fotoProdutoUri?.startsWith("http")
          ? item.fotoProdutoUri
          : null;
        let linkEtiqueta = item.fotoEtiquetaUri?.startsWith("http")
          ? item.fotoEtiquetaUri
          : null;
        if (!linkProduto && item.fotoProdutoUri)
          linkProduto = await uploadImagemParaNuvem(item.fotoProdutoUri);
        if (!linkEtiqueta && item.fotoEtiquetaUri)
          linkEtiqueta = await uploadImagemParaNuvem(item.fotoEtiquetaUri);
        return { ...item, linkProduto, linkEtiqueta };
      }),
    );

    for (const item of carrinhoComLinks) {
      const quantidade = Math.max(
        1,
        Math.round(parseFloat(item.qtd?.replace(",", ".") || "1")),
      );
      for (let i = 0; i < quantidade; i++) {
        await turso.execute({
          sql: "INSERT INTO compras_historico (codigo_barras, nome_produto, preco_prateleira, mes_referencia, foto_comprovante, foto_etiqueta, categoria, supermercado, familia_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            item.barras || "sem_codigo",
            item.nome,
            parseFloat(item.preco?.replace(",", ".") || "0"),
            mesReferencia,
            item.linkProduto,
            item.linkEtiqueta,
            item.categoria,
            mercadoNome,
            familiaId,
          ],
        });
      }
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
    carrinho.forEach((item) => {
      const preco = parseFloat(item.preco?.replace(",", ".") || "0");
      const qtd = parseFloat(item.qtd?.replace(",", ".") || "1");
      const subtotal = (preco * qtd).toFixed(2);
      const sufixo =
        String(item.qtd).includes(".") || String(item.qtd).includes(",")
          ? "kg"
          : "x";
      textoMensagem += `▪️ ${item.qtd}${sufixo} ${item.nome} - R$ ${subtotal}\n`;
    });
    textoMensagem += `\n💰 *Total Previsto: R$ ${total.toFixed(2)}*`;
    try {
      await Share.share({
        message: textoMensagem,
        title: "Minha Lista Dehouse",
      });
    } catch (error) {}
  };

  const editarItem = (item: any) => {
    Haptics.selectionAsync();
    setEditando(true);
    setPrecoAnterior(null);

    setProdutoAtual({
      id: String(item.id || ""),
      barras: String(item.barras || ""),
      nome: String(item.nome || ""),
      preco: String(item.preco || ""),
      qtd: String(item.qtd || "1"),
      categoria: String(item.categoria || "Alimentação"),
    });

    setFotoProduto(item.fotoProdutoUri ? { uri: item.fotoProdutoUri } : null);
    setFotoEtiqueta(
      item.fotoEtiquetaUri ? { uri: item.fotoEtiquetaUri } : null,
    );

    if (item.barras) {
      checarPrecoAnterior(item.barras)
        .then((res) => {
          if (res) setPrecoAnterior(res);
        })
        .catch(() => {});
    }
    setModalVisivel(true);
  };

  const checarComprasPendentes = async () => {
    try {
      const pendentes = await AsyncStorage.getItem("compras_offline");
      if (pendentes) {
        setTemSyncPendente(true);
        const dadosPendentes = JSON.parse(pendentes);
        const itens = Array.isArray(dadosPendentes)
          ? dadosPendentes
          : dadosPendentes.carrinho;
        const mercado = dadosPendentes.mercado || "Desconhecido";

        await processarCompra(itens, mercado);
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

  useEffect(() => {
    checarComprasPendentes();
  }, []);

  useEffect(() => {
    if (total > saldo && !alertaDisparado && total > 0 && saldo > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "⚠️ Saldo Estourado!",
        `O carrinho ultrapassou o seu saldo disponível.`,
      );
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

    const novoSaldo =
      tipoOperacaoCarteira === "adicionar" ? saldo + val : saldo - val;
    await atualizarSaldoBanco(novoSaldo);
    setModalRecargaVisivel(false);
    setValorRecarga("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const adicionarManualmente = () => {
    Haptics.selectionAsync();
    setScannerAtivo(false);
    setEditando(false);
    setPrecoAnterior(null);
    setFlashLigado(false);
    setFotoProduto(null);
    setFotoEtiqueta(null);
    setProdutoAtual({
      id: Date.now().toString(),
      barras: "",
      nome: "",
      preco: "",
      qtd: "1",
      categoria: "Alimentação",
    });
    setModalVisivel(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (travaScanner) return;
    setTravaScanner(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let nomePreenchido = "";
    let categoriaPreenchida = "Alimentação";
    const itemAntigo = await checarPrecoAnterior(data);

    if (itemAntigo) {
      nomePreenchido = String(itemAntigo.nome_produto);
      categoriaPreenchida = String(itemAntigo.categoria);
      setPrecoAnterior(itemAntigo);
    } else {
      nomePreenchido = await buscarNaInternet(data);
    }

    if (modoRapido) {
      adicionarItem(
        {
          id: Date.now().toString(),
          barras: data,
          nome: nomePreenchido || "Produto Novo (Flash)",
          preco: "0",
          qtd: "1",
          categoria: categoriaPreenchida,
        },
        false,
      );
      setTimeout(() => setTravaScanner(false), 1200);
      return;
    }

    setScannerAtivo(false);
    setEditando(false);
    setFotoProduto(null);
    setFotoEtiqueta(null);
    setFlashLigado(false);
    setProdutoAtual({
      id: Date.now().toString(),
      barras: data,
      nome: nomePreenchido,
      preco: "",
      qtd: "1",
      categoria: categoriaPreenchida,
    });
    setModalVisivel(true);
    setTimeout(() => setTravaScanner(false), 2000);
  };

  const handleLimparCarrinho = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert("Esvaziar", "Deseja apagar todos os itens do carrinho?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Esvaziar", style: "destructive", onPress: limparCarrinho },
    ]);
  };

  const capturarFotoPelaCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (cameraShotRef.current && modoTirarFoto) {
      try {
        const photo = await cameraShotRef.current.takePictureAsync({
          quality: 1,
        });

        // Passamos a foto pelo espremedor de imediato!
        const uriLeve = await comprimirImagem(photo.uri);
        const fotoDados = { uri: uriLeve };

        if (modoTirarFoto === "produto") setFotoProduto(fotoDados);
        else setFotoEtiqueta(fotoDados);
        setModoTirarFoto(null);
        setFlashLigado(false);
      } catch (e) {
        Alert.alert("Erro", "Não foi possível tirar a foto.");
        setModoTirarFoto(null);
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
      fotoEtiquetaUri: fotoEtiqueta?.uri || null,
    };

    adicionarItem(itemPronto, editando);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    setModalVisivel(false);
  };

  const abrirFinalizacao = () => {
    const itensSemPreco = carrinho.filter(
      (i) => parseFloat(i.preco?.replace(",", ".") || "0") === 0,
    );
    if (itensSemPreco.length > 0) {
      Alert.alert(
        "Itens sem preço!",
        "Você usou o Modo Rápido. Clique nos itens amarelos da lista e coloque o preço antes de passar no cartão.",
      );
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
    if (!nomeMercado.trim()) {
      Alert.alert("Obrigatório", "Digite o nome do supermercado.");
      return;
    }

    setModalMercadoVisivel(false);
    if (salvandoBanco) return;
    setSalvandoBanco(true);

    try {
      setStatusSalvamento("Descontando saldo e salvando...");
      await processarCompra(carrinho, nomeMercado);

      const novoSaldo = saldo - total;
      await atualizarSaldoBanco(novoSaldo);

      // Sincroniza logo a seguir para atualizar o Histórico!
      await sincronizarComNuvem();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Tudo Certo!", "Compra finalizada e salva no seu histórico.");
      limparCarrinho();
      setAlertaDisparado(false);
      setTemSyncPendente(false);
      setNomeMercado("");
    } catch (error) {
      await AsyncStorage.setItem(
        "compras_offline",
        JSON.stringify({ carrinho: carrinho, mercado: nomeMercado }),
      );
      setTemSyncPendente(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Sem Sinal 📶",
        "Sua compra foi salva no celular e será enviada à nuvem depois.",
      );
      limparCarrinho();
      setAlertaDisparado(false);
      setNomeMercado("");
    } finally {
      setSalvandoBanco(false);
      setStatusSalvamento("");
    }
  };

  const renderCarrinhoItem = ({ item }: any) => {
    const precoNum = parseFloat(item.preco?.replace(",", ".") || "0");
    const qtdNum = parseFloat(item.qtd?.replace(",", ".") || "1");
    const subtotalItem = (precoNum * qtdNum).toFixed(2);
    const sufixo =
      String(item.qtd).includes(".") || String(item.qtd).includes(",")
        ? "kg"
        : "x";

    return (
      <TouchableOpacity
        style={[
          styles.itemCarrinho,
          precoNum === 0 && styles.itemCarrinhoAlerta,
        ]}
        onPress={() => editarItem(item)}
      >
        <View style={styles.itemInfo}>
          {item.fotoProdutoUri ? (
            <Image
              source={{ uri: item.fotoProdutoUri }}
              style={styles.miniature}
            />
          ) : (
            <View style={styles.miniaturePlaceholder}>
              <Ionicons
                name="basket-outline"
                size={20}
                color={color.textSecondary}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.itemNome}>
              {item.qtd}
              {sufixo} {item.nome}
            </Text>
            <Text style={styles.itemPrecoUnid}>
              {item.categoria}{" "}
              {precoNum === 0
                ? "⚠️ Faltando preço!"
                : `• R$ ${precoNum.toFixed(2)} ${sufixo === "kg" ? "o kg" : "un."}`}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.itemSubtotal}>R$ {subtotalItem}</Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              removerItem(item.id);
            }}
            style={{ marginTop: 5 }}
          >
            <Text
              style={{ color: color.warning, fontSize: 12, fontWeight: "bold" }}
            >
              Excluir
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (!permission)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={color.tint} />
      </View>
    );

  if (!usuario) {
    return (
      <SafeAreaView
        style={[
          styles.center,
          { padding: 24, backgroundColor: color.background },
        ]}
      >
        <Ionicons
          name="cart"
          size={80}
          color={color.tint}
          style={{ marginBottom: 20 }}
        />
        <Text
          style={{
            fontSize: 32,
            fontWeight: "900",
            color: color.text,
            marginBottom: 10,
            textAlign: "center",
            letterSpacing: -1,
          }}
        >
          Dehouse Market
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: color.textSecondary,
            textAlign: "center",
            marginBottom: 40,
            paddingHorizontal: 20,
          }}
        >
          Organize compras, compare preços e gira o orçamento com a sua família.
        </Text>

        <View style={{ width: "100%", gap: 12, marginBottom: 30 }}>
          <TextInput
            style={styles.inputAuth}
            placeholder="O seu e-mail"
            placeholderTextColor={color.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={emailInput}
            onChangeText={setEmailInput}
          />
          <TextInput
            style={styles.inputAuth}
            placeholder="Palavra-passe"
            placeholderTextColor={color.textSecondary}
            secureTextEntry
            value={senhaInput}
            onChangeText={setSenhaInput}
          />

          <TouchableOpacity
            style={[
              styles.btnAdicionarCarrinho,
              { backgroundColor: color.tint, marginTop: 10, marginBottom: 0 },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              useAuthStore.getState().entrarOuRegistar(emailInput, senhaInput);
            }}
          >
            <Text style={styles.textoBotaoBranco}>Entrar / Registar</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 30,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
          <Text
            style={{
              color: color.textSecondary,
              paddingHorizontal: 16,
              fontSize: 12,
              fontWeight: "bold",
            }}
          >
            OU CONTINUE COM
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: color.border }} />
        </View>

        <TouchableOpacity
          style={{
            width: "100%",
            backgroundColor: color.card,
            padding: 16,
            borderRadius: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: color.border,
            elevation: 2,
          }}
          onPress={() => {
            Haptics.selectionAsync();
            useAuthStore.getState().entrarComGoogle();
          }}
        >
          <Ionicons
            name="logo-google"
            size={20}
            color={color.text}
            style={{ marginRight: 12 }}
          />
          <Text style={{ color: color.text, fontWeight: "bold", fontSize: 16 }}>
            Entrar com o Google
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!familiaId) {
    return (
      <SafeAreaView
        style={[
          styles.center,
          { padding: 24, backgroundColor: color.background },
        ]}
      >
        <Image
          source={{ uri: usuario.foto }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            marginBottom: 16,
            borderWidth: 3,
            borderColor: color.tint,
          }}
        />
        <Text
          style={{
            fontSize: 24,
            fontWeight: "bold",
            color: color.text,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Olá, {usuario.nome}!
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: color.textSecondary,
            textAlign: "center",
            marginBottom: 40,
          }}
        >
          Para partilhares compras com alguém da tua casa, precisas de criar uma
          família ou entrar numa já existente.
        </Text>

        <View
          style={{
            width: "100%",
            backgroundColor: color.card,
            padding: 24,
            borderRadius: 24,
            elevation: 2,
            borderWidth: 1,
            borderColor: color.border,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: color.text,
              marginBottom: 12,
            }}
          >
            Recebeste um código?
          </Text>
          <TextInput
            style={[
              styles.inputAuth,
              {
                marginBottom: 16,
                textAlign: "center",
                letterSpacing: 4,
                fontWeight: "bold",
              },
            ]}
            placeholder="Ex: A8X9P"
            placeholderTextColor={color.textSecondary}
            value={codigoInput}
            autoCapitalize="characters"
            onChangeText={setCodigoInput}
          />
          <TouchableOpacity
            style={[
              styles.btnAdicionarCarrinho,
              { backgroundColor: color.info, marginBottom: 0 },
            ]}
            onPress={() => {
              if (codigoInput.trim().length < 4)
                return Alert.alert("Erro", "Código inválido.");
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
              setFamiliaId(codigoInput.trim());
            }}
          >
            <Text style={styles.textoBotaoBranco}>Entrar na Família</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            height: 1,
            width: "100%",
            backgroundColor: color.border,
            marginVertical: 30,
          }}
        />

        <TouchableOpacity
          style={{
            width: "100%",
            backgroundColor: color.tint,
            padding: 20,
            borderRadius: 20,
            alignItems: "center",
          }}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            gerarNovaFamilia();
          }}
        >
          <Ionicons
            name="home"
            size={24}
            color="white"
            style={{ marginBottom: 8 }}
          />
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
            Criar a Minha Família
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.permissaoCard}>
          <Ionicons name="camera" size={64} color={color.tint} />
          <Text style={styles.permissaoTitulo}>Câmera Necessária</Text>
          <Text style={styles.textoPermissao}>
            Libere o acesso à câmera para escanear produtos.
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={requestPermission}
          >
            <Text style={styles.textoBotaoBranco}>Permitir Acesso</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const porcentagemGasta = saldo > 0 ? (total / saldo) * 100 : 0;
  const corProgresso =
    total > saldo
      ? color.danger
      : porcentagemGasta > 80
        ? color.warning
        : color.tint;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerPerfil}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={{ uri: usuario?.foto }} style={styles.fotoPerfilMin} />
          <View>
            <Text style={styles.boasVindas}>Olá, {usuario?.nome}</Text>
            <TouchableOpacity
              style={styles.pillFamilia}
              onPress={() =>
                Share.share({
                  message: `Participe da minha família no Dehouse usando o código: ${familiaId}`,
                })
              }
            >
              <Text style={styles.textoPillFamilia}>Família: {familiaId}</Text>
              <Ionicons
                name="share-social"
                size={12}
                color={color.tint}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Terminar Sessão", "Deseja sair da sua conta?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: fazerLogout },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={26} color={color.danger} />
        </TouchableOpacity>
      </View>

      <View style={[styles.walletCard, { marginTop: 0 }]}>
        <View style={styles.walletHeader}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="card" size={24} color="#FFC857" />
            <Text style={styles.walletTitle}>Cartão Dehouse</Text>
            {/* 🔥 ÍCONE CORRIGIDO: Nuvem de Upload sem cortes e com cor de destaque! */}
            <TouchableOpacity
              onPress={checarComprasPendentes}
              style={{
                marginLeft: 12,
                paddingHorizontal: 4,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="cloud-upload"
                size={24}
                color={temSyncPendente ? color.warning : "transparent"}
              />
              {temSyncPendente && (
                <View style={[styles.pontoNuvem, { right: -2, top: -2 }]} />
              )}
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setTipoOperacaoCarteira("remover");
                setModalRecargaVisivel(true);
              }}
              style={styles.btnRemover}
            >
              <Ionicons name="remove-circle" size={16} color={color.danger} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync();
                setTipoOperacaoCarteira("adicionar");
                setModalRecargaVisivel(true);
              }}
              style={styles.btnRecarga}
            >
              <Ionicons name="add-circle" size={16} color="white" />
              <Text style={styles.textoBtnRecarga}>Recarregar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.labelSaldo}>Saldo Após a Compra</Text>
        <Text
          style={[
            styles.valorSaldo,
            { color: total > saldo ? color.danger : color.text },
          ]}
        >
          R$ {(saldo - total).toFixed(2)}
        </Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            No Carrinho: R$ {total.toFixed(2)}
          </Text>
          <Text style={styles.infoText}>
            Saldo Atual: R$ {saldo.toFixed(2)}
          </Text>
        </View>
        <View style={styles.barraFundo}>
          <View
            style={[
              styles.barraProgresso,
              {
                width: `${Math.min(porcentagemGasta, 100)}%`,
                backgroundColor: corProgresso,
              },
            ]}
          />
        </View>
      </View>

      {!scannerAtivo ? (
        <View style={styles.botoesAcaoContainer}>
          <TouchableOpacity
            style={styles.btnAcaoScan}
            onPress={() => {
              Haptics.selectionAsync();
              setScannerAtivo(true);
            }}
          >
            <Ionicons name="barcode-outline" size={24} color="white" />
            <Text style={styles.textoBotaoAcaoBranco}>Escanear Código</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnAcaoManual}
            onPress={adicionarManualmente}
          >
            <Ionicons name="create-outline" size={24} color={color.info} />
            <Text style={styles.textoBotaoAcaoAzul}>Digitar Manual</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={flashLigado}
            ref={scannerRef}
            onBarcodeScanned={
              modalVisivel || modoTirarFoto ? undefined : handleBarcodeScanned
            }
          />
          <View
            style={[StyleSheet.absoluteFillObject, styles.overlayScanner]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.btnLanterna}
              onPress={() => {
                Haptics.selectionAsync();
                setFlashLigado(!flashLigado);
              }}
            >
              <Ionicons
                name={flashLigado ? "flash" : "flash-off"}
                size={28}
                color={flashLigado ? "#FFC857" : "white"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnModoRapido,
                modoRapido && styles.btnModoRapidoAtivo,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setModoRapido(!modoRapido);
              }}
            >
              <Ionicons
                name="rocket"
                size={26}
                color={modoRapido ? "#FFC857" : "white"}
              />
              {modoRapido && (
                <Text
                  style={{
                    color: "#FFC857",
                    fontWeight: "bold",
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  FLASH ON
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnFecharScanner}
              onPress={() => {
                Haptics.selectionAsync();
                setScannerAtivo(false);
                setFlashLigado(false);
                setModoRapido(false);
              }}
            >
              <Ionicons name="close-circle" size={36} color="white" />
            </TouchableOpacity>
            <View pointerEvents="none" style={styles.miraScanner}>
              <Ionicons
                name="scan-outline"
                size={60}
                color={modoRapido ? "#FFC857" : "rgba(255,255,255,0.8)"}
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.listaContainer}>
        <View style={styles.headerLista}>
          <Text style={styles.tituloSecao}>
            Itens Adicionados ({carrinho.length})
          </Text>
          {carrinho.length > 0 && (
            <View
              style={{ flexDirection: "row", gap: 16, alignItems: "center" }}
            >
              <TouchableOpacity onPress={compartilharCarrinho}>
                <Ionicons name="share-outline" size={22} color={color.info} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLimparCarrinho}>
                <Text style={styles.btnLimparTexto}>Esvaziar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <FlatList
          data={carrinho}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 }}
          renderItem={renderCarrinhoItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.tint}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="cloud-done-outline"
                size={60}
                color={color.borderDark}
              />
              <Text style={styles.listaVazia}>
                Carrinho vazio. Puxe para sincronizar.
              </Text>
            </View>
          }
        />
      </View>

      <View
        style={{
          width: "100%",
          alignItems: "center",
          backgroundColor: color.card,
          paddingVertical: 5,
          position: "absolute",
          bottom: carrinho.length > 0 ? 80 : 0,
          zIndex: 1,
          borderTopWidth: 1,
          borderColor: color.border,
        }}
      >
        <Text
          style={{ fontSize: 10, color: color.textSecondary, marginBottom: 2 }}
        >
          Espaço Publicitário
        </Text>

        <BannerAd
          unitId={
            __DEV__ ? TestIds.BANNER : "ca-app-pub-5151678673256465/5749519307"
          }
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        />
      </View>

      {carrinho.length > 0 && (
        <View style={[styles.footerFloat, { zIndex: 2 }]}>
          <TouchableOpacity
            style={styles.btnFinalizar}
            onPress={abrirFinalizacao}
            disabled={salvandoBanco}
          >
            {salvandoBanco ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ActivityIndicator color="white" style={{ marginRight: 10 }} />
                <Text style={styles.textoBotaoBranco}>{statusSalvamento}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.textoBotaoBranco}>Passar no Cartão</Text>
                <Ionicons
                  name="card"
                  size={20}
                  color="white"
                  style={{ marginLeft: 8 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!scannerAtivo && (
        <TouchableOpacity
          style={[
            styles.btnCalcFlutuante,
            { backgroundColor: theme === "dark" ? "#333" : "#1E1E1E" },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setModalCalcVisivel(true);
          }}
        >
          <Ionicons name="calculator" size={24} color="#FFC857" />
        </TouchableOpacity>
      )}

      <Modal
        visible={modalMercadoVisivel}
        animationType="fade"
        transparent={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdropCentral}
        >
          <View style={styles.modalContentCentral}>
            <Ionicons
              name="storefront"
              size={48}
              color={color.tint}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.modalTituloCentral}>Onde você está?</Text>
            <Text
              style={{
                color: color.textSecondary,
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Isso ajuda a rastrear onde os produtos estão mais baratos no
              histórico.
            </Text>
            <TextInput
              style={[
                styles.inputModal,
                { width: "100%", marginBottom: 20, textAlign: "center" },
              ]}
              placeholder="Ex: Assaí, Atacadão..."
              placeholderTextColor={color.textSecondary}
              value={nomeMercado}
              onChangeText={setNomeMercado}
            />
            <TouchableOpacity
              onPress={confirmarCompraFinal}
              style={[styles.btnConfirmarDep, { backgroundColor: color.tint }]}
            >
              <Text style={styles.textoBotaoBranco}>Finalizar Compra</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalMercadoVisivel(false)}
              style={{ padding: 10 }}
            >
              <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={modalRecargaVisivel}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalRecargaVisivel(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdropCentral}
        >
          <View style={styles.modalContentCentral}>
            <Ionicons
              name={
                tipoOperacaoCarteira === "adicionar" ? "wallet" : "cash-outline"
              }
              size={48}
              color={
                tipoOperacaoCarteira === "adicionar" ? color.tint : color.danger
              }
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.modalTituloCentral}>
              {tipoOperacaoCarteira === "adicionar"
                ? "Adicionar Saldo"
                : "Remover Saldo"}
            </Text>
            <TextInput
              style={[
                styles.inputGigante,
                {
                  color:
                    tipoOperacaoCarteira === "adicionar"
                      ? color.tint
                      : color.danger,
                },
              ]}
              placeholder="R$ 0,00"
              placeholderTextColor={color.textSecondary}
              keyboardType="numeric"
              value={valorRecarga}
              onChangeText={setValorRecarga}
            />
            <TouchableOpacity
              onPress={gerenciarCarteira}
              style={[
                styles.btnConfirmarDep,
                {
                  backgroundColor:
                    tipoOperacaoCarteira === "adicionar"
                      ? color.tint
                      : color.danger,
                },
              ]}
            >
              <Text style={styles.textoBotaoBranco}>
                {tipoOperacaoCarteira === "adicionar"
                  ? "Confirmar Depósito"
                  : "Confirmar Remoção"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setModalRecargaVisivel(false);
                setValorRecarga("");
              }}
              style={{ padding: 10 }}
            >
              <Text style={{ color: color.textSecondary, fontWeight: "bold" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={modalVisivel}
        animationType="slide"
        transparent={true}
        onRequestClose={fecharModalCadastro}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContent}>
            <View style={styles.dragPill} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>
                {editando ? "Editar Produto" : "Detalhes do Produto"}
              </Text>
              <TouchableOpacity
                onPress={fecharModalCadastro}
                style={styles.btnClose}
              >
                <Ionicons name="close" size={24} color={color.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalForm}
              contentContainerStyle={{ paddingBottom: 250 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {precoAnterior && (
                <View style={styles.alertaInflacao}>
                  <Ionicons name="analytics" size={24} color="#1E1E1E" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.textoInflacao}>
                      Última compra:{" "}
                      <Text style={{ fontWeight: "bold" }}>
                        R$ {Number(precoAnterior.preco_prateleira).toFixed(2)}
                      </Text>{" "}
                      no {precoAnterior.supermercado || "mercado"}
                    </Text>

                    {produtoAtual.preco && parseFloat(produtoAtual.preco) > 0
                      ? (() => {
                          const precoAtualNum = parseFloat(
                            produtoAtual.preco.replace(",", "."),
                          );
                          const precoAntigoNum = Number(
                            precoAnterior.preco_prateleira,
                          );
                          if (precoAtualNum > precoAntigoNum) {
                            const dif =
                              ((precoAtualNum - precoAntigoNum) /
                                precoAntigoNum) *
                              100;
                            return (
                              <Text
                                style={{
                                  color: "#EF4444",
                                  fontWeight: "bold",
                                  fontSize: 13,
                                  marginTop: 2,
                                }}
                              >
                                📈 Subiu {dif.toFixed(1)}%
                              </Text>
                            );
                          } else if (precoAtualNum < precoAntigoNum) {
                            const dif =
                              ((precoAntigoNum - precoAtualNum) /
                                precoAntigoNum) *
                              100;
                            return (
                              <Text
                                style={{
                                  color: "#2ED1B2",
                                  fontWeight: "bold",
                                  fontSize: 13,
                                  marginTop: 2,
                                }}
                              >
                                📉 Caiu {dif.toFixed(1)}%
                              </Text>
                            );
                          }
                          return (
                            <Text
                              style={{
                                color: "#1E1E1E",
                                fontWeight: "bold",
                                fontSize: 13,
                                marginTop: 2,
                              }}
                            >
                              ➖ Preço Manteve
                            </Text>
                          );
                        })()
                      : null}
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.labelField}>CÓDIGO DE BARRAS</Text>
                <TextInput
                  style={styles.inputModal}
                  placeholderTextColor={color.textSecondary}
                  placeholder="00000000"
                  value={produtoAtual.barras}
                  onChangeText={(t) =>
                    setProdutoAtual({ ...produtoAtual, barras: t })
                  }
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.labelField}>NOME DO PRODUTO</Text>
                <TextInput
                  style={styles.inputModal}
                  placeholderTextColor={color.textSecondary}
                  placeholder="Ex: Arroz 1kg"
                  value={produtoAtual.nome}
                  onChangeText={(t) =>
                    setProdutoAtual({ ...produtoAtual, nome: t })
                  }
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={[styles.inputGroup, { flex: 2, marginRight: 12 }]}>
                  <Text style={styles.labelField}>PREÇO UN/KG (R$)</Text>
                  <TextInput
                    style={styles.inputModal}
                    placeholderTextColor={color.textSecondary}
                    keyboardType="numeric"
                    placeholder="0,00"
                    value={produtoAtual.preco}
                    onChangeText={(t) =>
                      setProdutoAtual({
                        ...produtoAtual,
                        preco: t.replace(",", "."),
                      })
                    }
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.labelField}>QTD / KG</Text>
                  <TextInput
                    style={styles.inputModal}
                    placeholderTextColor={color.textSecondary}
                    keyboardType="numeric"
                    placeholder="1"
                    value={produtoAtual.qtd}
                    onChangeText={(t) =>
                      setProdutoAtual({
                        ...produtoAtual,
                        qtd: t.replace(",", "."),
                      })
                    }
                  />
                </View>
              </View>

              <Text style={styles.labelField}>CATEGORIA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {CATEGORIAS.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catPill,
                      produtoAtual.categoria === cat && styles.catPillActive,
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setProdutoAtual({ ...produtoAtual, categoria: cat });
                    }}
                  >
                    <Text
                      style={[
                        styles.catText,
                        produtoAtual.categoria === cat && styles.catTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.labelField}>
                COMPROVANTES VISUAIS (PROVAS)
              </Text>
              <View style={styles.rowFotos}>
                <View style={styles.boxFotoContainer}>
                  <TouchableOpacity
                    style={styles.boxFoto}
                    onPress={() => {
                      Haptics.selectionAsync();
                      fotoProduto
                        ? setFotoAmpliada(fotoProduto.uri)
                        : setModoTirarFoto("produto");
                    }}
                  >
                    {fotoProduto ? (
                      <Image
                        source={{ uri: fotoProduto.uri }}
                        style={styles.imagePreview}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="cube-outline"
                          size={28}
                          color={color.info}
                        />
                        <Text style={styles.textBtnFoto}>Produto</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {fotoProduto && (
                    <TouchableOpacity
                      style={styles.btnRemoverFoto}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFotoProduto(null);
                      }}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.boxFotoContainer}>
                  <TouchableOpacity
                    style={styles.boxFoto}
                    onPress={() => {
                      Haptics.selectionAsync();
                      fotoEtiqueta
                        ? setFotoAmpliada(fotoEtiqueta.uri)
                        : setModoTirarFoto("etiqueta");
                    }}
                  >
                    {fotoEtiqueta ? (
                      <Image
                        source={{ uri: fotoEtiqueta.uri }}
                        style={styles.imagePreview}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="pricetag-outline"
                          size={28}
                          color={color.info}
                        />
                        <Text style={styles.textBtnFoto}>Etiqueta</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {fotoEtiqueta && (
                    <TouchableOpacity
                      style={styles.btnRemoverFoto}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setFotoEtiqueta(null);
                      }}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.btnAdicionarCarrinho}
                onPress={salvarNoCarrinho}
              >
                <Text style={styles.textoBotaoBranco}>
                  {editando ? "Atualizar Carrinho" : "Adicionar ao Carrinho"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={fotoAmpliada !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFotoAmpliada(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 50,
              right: 20,
              zIndex: 10,
              padding: 10,
            }}
            onPress={() => setFotoAmpliada(null)}
          >
            <Ionicons name="close-circle" size={40} color="white" />
          </TouchableOpacity>
          {fotoAmpliada && (
            <Image
              source={{ uri: fotoAmpliada }}
              style={{ width: "100%", height: "80%", resizeMode: "contain" }}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={modoTirarFoto !== null}
        animationType="fade"
        onRequestClose={() => {
          setModoTirarFoto(null);
          setFlashLigado(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "black" }}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            ref={cameraShotRef}
            enableTorch={flashLigado}
          />
          <SafeAreaView
            style={[StyleSheet.absoluteFillObject, styles.overlayPreviaFoto]}
            pointerEvents="box-none"
          >
            <View style={styles.headerPrevia}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setFlashLigado(!flashLigado);
                }}
                style={{ padding: 10 }}
              >
                <Ionicons
                  name={flashLigado ? "flash" : "flash-off"}
                  size={24}
                  color={flashLigado ? "#FFC857" : "white"}
                />
              </TouchableOpacity>
              <Text style={styles.textoHeaderPrevia}>
                Foto: {modoTirarFoto === "produto" ? "Produto" : "Etiqueta"}
              </Text>
              <View style={{ width: 44 }} />
            </View>
            <View style={styles.footerPrevia}>
              <TouchableOpacity
                style={styles.btnCancelarFoto}
                onPress={() => {
                  setModoTirarFoto(null);
                  setFlashLigado(false);
                }}
              >
                <Text style={styles.textoBotaoBranco}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnShutter}
                onPress={capturarFotoPelaCamera}
              >
                <View style={styles.shutterInternal} />
              </TouchableOpacity>
              <View style={{ width: 80 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <CalculadoraModal
        visivel={modalCalcVisivel}
        fecharModal={() => setModalCalcVisivel(false)}
        color={color}
      />
    </SafeAreaView>
  );
}

const getStyles = (c: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.background,
    },

    headerPerfil: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 15,
    },
    fotoPerfilMin: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: 12,
      backgroundColor: c.border,
    },
    boasVindas: { fontSize: 18, fontWeight: "bold", color: c.text },
    pillFamilia: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 4,
    },
    textoPillFamilia: { fontSize: 11, color: c.tint, fontWeight: "bold" },
    inputAuth: {
      backgroundColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderRadius: 16,
      fontSize: 16,
      color: c.text,
      fontWeight: "500",
    },

    permissaoCard: {
      backgroundColor: c.card,
      padding: 30,
      borderRadius: 24,
      alignItems: "center",
      width: "85%",
      elevation: 10,
    },
    permissaoTitulo: {
      fontSize: 20,
      fontWeight: "bold",
      color: c.text,
      marginTop: 15,
      marginBottom: 8,
    },
    textoPermissao: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      marginBottom: 25,
      lineHeight: 22,
    },
    walletCard: {
      backgroundColor: c.card,
      margin: 16,
      padding: 20,
      borderRadius: 24,
      elevation: 3,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    walletHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    walletTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: c.text,
      marginLeft: 8,
    },
    pontoNuvem: {
      position: "absolute",
      top: -2,
      right: -4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: c.warning,
    },
    btnRecarga: {
      flexDirection: "row",
      backgroundColor: c.tint,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: "center",
    },
    textoBtnRecarga: {
      color: "white",
      fontWeight: "bold",
      fontSize: 12,
      marginLeft: 4,
    },
    btnRemover: {
      flexDirection: "row",
      backgroundColor: "transparent",
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: "center",
    },
    labelSaldo: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: "bold",
      textTransform: "uppercase",
    },
    valorSaldo: {
      fontSize: 44,
      fontWeight: "900",
      letterSpacing: -1.5,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    infoText: { fontSize: 12, color: c.textSecondary, fontWeight: "600" },
    barraFundo: {
      height: 8,
      backgroundColor: c.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    barraProgresso: { height: "100%", borderRadius: 4 },
    textoPorcentagem: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 8,
      textAlign: "right",
      fontWeight: "500",
    },
    botoesAcaoContainer: {
      flexDirection: "row",
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    btnAcaoScan: {
      flex: 1,
      backgroundColor: c.warning,
      paddingVertical: 14,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
      elevation: 2,
    },
    btnAcaoManual: {
      flex: 1,
      backgroundColor: c.card,
      paddingVertical: 14,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.info,
    },
    textoBotaoAcaoBranco: {
      color: "white",
      fontWeight: "bold",
      fontSize: 15,
      marginLeft: 8,
    },
    textoBotaoAcaoAzul: {
      color: c.info,
      fontWeight: "bold",
      fontSize: 15,
      marginLeft: 8,
    },
    scannerContainer: {
      height: 180,
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    overlayScanner: {
      backgroundColor: "rgba(0,0,0,0.3)",
      justifyContent: "center",
      alignItems: "center",
    },
    miraScanner: { alignItems: "center", justifyContent: "center" },
    btnModoRapido: {
      position: "absolute",
      bottom: 20,
      alignSelf: "center",
      alignItems: "center",
      padding: 10,
    },
    btnModoRapidoAtivo: {
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 16,
    },
    btnLanterna: {
      position: "absolute",
      top: 12,
      left: 12,
      zIndex: 10,
      padding: 4,
    },
    btnFecharScanner: { position: "absolute", top: 12, right: 12, zIndex: 10 },
    listaContainer: { flex: 1, paddingHorizontal: 16 },
    headerLista: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      marginTop: 8,
    },
    tituloSecao: { fontSize: 16, fontWeight: "bold", color: c.text },
    btnLimparTexto: { color: c.warning, fontWeight: "bold", fontSize: 13 },
    emptyState: { alignItems: "center", marginTop: 40 },
    listaVazia: {
      color: c.textSecondary,
      fontSize: 15,
      marginTop: 12,
      fontWeight: "500",
    },
    itemCarrinho: {
      flexDirection: "row",
      backgroundColor: c.card,
      padding: 16,
      borderRadius: 20,
      marginBottom: 10,
      alignItems: "center",
      justifyContent: "space-between",
      elevation: 1,
    },
    itemCarrinhoAlerta: {
      borderWidth: 1,
      borderColor: "#FFC857",
      backgroundColor: "#FFFAED",
    },
    itemInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
    miniature: { width: 44, height: 44, borderRadius: 12, marginRight: 12 },
    miniaturePlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 12,
      marginRight: 12,
      backgroundColor: c.border,
      justifyContent: "center",
      alignItems: "center",
    },
    itemNome: {
      fontSize: 15,
      fontWeight: "700",
      color: c.text,
      marginBottom: 2,
    },
    itemPrecoUnid: { fontSize: 12, color: c.textSecondary, fontWeight: "500" },
    itemSubtotal: { fontSize: 16, fontWeight: "800", color: "#FFC857" },
    footerFloat: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: c.overlay,
    },
    btnFinalizar: {
      backgroundColor: c.tint,
      paddingVertical: 16,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      elevation: 3,
    },
    modalBackdropCentral: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      padding: 20,
    },
    modalContentCentral: {
      backgroundColor: c.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.8)",
    },
    modalContent: {
      backgroundColor: c.card,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      paddingBottom: 20,
      maxHeight: "90%",
    },
    dragPill: {
      width: 40,
      height: 5,
      backgroundColor: c.borderDark,
      borderRadius: 3,
      alignSelf: "center",
      marginTop: 12,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 10,
    },
    modalTitulo: { fontSize: 20, fontWeight: "bold", color: c.text },
    btnClose: { padding: 4, backgroundColor: c.border, borderRadius: 20 },
    modalForm: { paddingHorizontal: 24 },
    alertaInflacao: {
      backgroundColor: "#FFC857",
      padding: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    textoInflacao: { color: "#1E1E1E", fontSize: 13 },
    inputGroup: { marginBottom: 12 },
    labelField: {
      fontSize: 11,
      color: c.textSecondary,
      marginBottom: 6,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    inputModal: {
      backgroundColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      fontSize: 16,
      color: c.text,
      fontWeight: "500",
    },
    inputGigante: {
      backgroundColor: c.border,
      width: "100%",
      padding: 16,
      borderRadius: 12,
      fontSize: 24,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 20,
    },
    rowInputs: { flexDirection: "row" },
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
    rowFotos: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    boxFotoContainer: { width: "48%", position: "relative" },
    boxFoto: {
      height: 90,
      backgroundColor: c.border,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.info,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    btnRemoverFoto: {
      position: "absolute",
      top: -8,
      right: -8,
      backgroundColor: c.danger,
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: "center",
      alignItems: "center",
      elevation: 2,
      zIndex: 10,
    },
    textBtnFoto: {
      color: c.info,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 6,
    },
    imagePreview: { width: "100%", height: "100%" },
    btnAdicionarCarrinho: {
      backgroundColor: c.info,
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
      marginBottom: 20,
    },
    btnConfirmarDep: {
      width: "100%",
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 16,
    },
    btnPrimary: {
      backgroundColor: c.warning,
      paddingVertical: 14,
      paddingHorizontal: 30,
      borderRadius: 16,
    },
    btnCalcFlutuante: {
      position: "absolute",
      bottom: 90,
      right: 20,
      padding: 16,
      borderRadius: 30,
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      flexDirection: "row",
      alignItems: "center",
      zIndex: 10,
    },
    overlayPreviaFoto: { justifyContent: "space-between" },
    headerPrevia: {
      flexDirection: "row",
      padding: 20,
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    textoHeaderPrevia: { color: "white", fontWeight: "bold", fontSize: 16 },
    footerPrevia: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 30,
      paddingBottom: 50,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    btnCancelarFoto: { width: 80, alignItems: "center" },
    btnShutter: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: "white",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 4,
      borderColor: "rgba(255,255,255,0.3)",
    },
    shutterInternal: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: "white",
      borderWidth: 2,
      borderColor: "#1E1E1E",
    },
  });
