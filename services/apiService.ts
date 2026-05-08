// services/apiService.ts
import * as ImageManipulator from "expo-image-manipulator";

const IMGBB_API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

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

export const buscarNaInternet = async (codigo: string): Promise<string> => {
  // 1. TENTATIVA: OpenFoodFacts (Base Global e Gratuita)
  try {
    const resOff = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
    const dadosOff = await resOff.json();
    if (dadosOff.status === 1 && dadosOff.product.product_name) {
      return dadosOff.product.product_name;
    }
  } catch (error) {
    console.log("Falha no OpenFoodFacts");
  }

  // 2. TENTATIVA: Cosmos API (Base Brasileira Secundária)
  try {
    const resCosmos = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (resCosmos.ok) {
      const dadosCosmos = await resCosmos.json();
      if (dadosCosmos.description) return dadosCosmos.description;
    }
  } catch (e) {
    console.log("Falha no Cosmos");
  }

  // 3. TENTATIVA DEFINITIVA: Inteligência Artificial (Groq)
  if (GROQ_API_KEY) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ 
            role: "system", 
            content: `Você é um assistente de supermercado brasileiro. O código de barras EAN/GTIN '${codigo}' costuma pertencer a qual produto comercial? Responda APENAS com o nome do produto curto e direto. Se for impossível saber, responda exatamente a palavra "DESCONHECIDO".`
          }],
          temperature: 0.2
        })
      });
      
      if (res.ok) {
         const data = await res.json();
         const resposta = data.choices[0].message.content.trim().replace(/["']/g, '');
         if (resposta && !resposta.toUpperCase().includes("DESCONHECIDO")) {
           return resposta;
         }
      }
    } catch(e) {
       console.log("Falha na IA Groq");
    }
  }

  // Se todas as 3 falharem, retorna vazio para o utilizador digitar manualmente
  return "";
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