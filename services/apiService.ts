import * as ImageManipulator from "expo-image-manipulator";

const IMGBB_API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY;

export const comprimirImagem = async (uriOriginal: string): Promise<string> => {
  try {
    const imagemComprimida = await ImageManipulator.manipulateAsync(
      uriOriginal,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return imagemComprimida.uri;
  } catch (error) {
    console.error("Erro ao comprimir:", error);
    return uriOriginal;
  }
};

// 🔥 BUSCA PARALELA DE ALTA VELOCIDADE (RACE CONDITION)
export const buscarNaInternet = async (codigo: string): Promise<string> => {
  
  // Função auxiliar para padronizar as buscas
  const tentarApi = async (url: string, extrairNome: (dados: any) => string, headers = {}) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Falha na requisição");
    const dados = await res.json();
    const nome = extrairNome(dados);
    if (!nome) throw new Error("Produto não encontrado");
    return nome;
  };

  // Disparamos as 4 consultas EXATAMENTE AO MESMO TEMPO
  const buscas = [
    // 1. Alimentação
    tentarApi(
      `https://world.openfoodfacts.org/api/v0/product/${codigo}.json`, 
      (d) => d.status === 1 ? d.product.product_name : ""
    ),
    // 2. Beleza e Higiene
    tentarApi(
      `https://world.openbeautyfacts.org/api/v0/product/${codigo}.json`, 
      (d) => d.status === 1 ? d.product.product_name : ""
    ),
    // 3. Utensílios e Geral
    tentarApi(
      `https://world.openproductsfacts.org/api/v0/product/${codigo}.json`, 
      (d) => d.status === 1 ? d.product.product_name : ""
    ),
    // 4. Base Brasileira Cosmos
    tentarApi(
      `https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, 
      (d) => d.description, 
      { "User-Agent": "Mozilla/5.0" }
    )
  ];

  try {
    // 🔥 Promise.any devolve IMEDIATAMENTE a primeira API que encontrar o produto!
    const nomeProduto = await Promise.any(buscas);
    return nomeProduto || "";
  } catch (e) {
    // Se TODAS falharem (produto não existe em lado nenhum), retorna vazio
    return "";
  }
};

export const uploadImagemParaNuvem = async (fileUri: string): Promise<string | null> => {
  try {
    const data = new FormData();
    data.append("image", {
      uri: fileUri,
      name: "foto.jpg",
      type: "image/jpeg",
    } as any);

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: data,
      headers: { "Content-Type": "multipart/form-data" },
    });
    
    const json = await res.json();
    if (json.data && json.data.url) return json.data.url;
    return null;
  } catch (error) {
    console.error("Erro no upload da imagem:", error);
    return null;
  }
};