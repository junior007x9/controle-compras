const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const OCR_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY;

// Função centralizada e segura para chamar a Groq
async function chamarGroq(systemPrompt: string, userText: string) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192', 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText }
        ],
        temperature: 0.1 
      })
    });

    const data = await response.json();
    let texto = data.choices[0].message.content;
    
    // Garante que a IA não quebre o JSON com textos extras
    const match = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(texto);
  } catch (error) {
    console.error("Erro na IA:", error);
    return null;
  }
}

// 1. INTELIGÊNCIA DA LISTA
export async function categorizarCompraComIA(textoDoUsuario: string) {
  const prompt = `Retorne APENAS um JSON válido. Classifique o produto em uma destas categorias: Alimentação, Limpeza, Higiene, Bebidas, Outros. Exemplo: {"categoria": "Limpeza"}`;
  return await chamarGroq(prompt, textoDoUsuario);
}

// 2. INTELIGÊNCIA DA SEFAZ (QR CODE)
export async function extrairNotaDaSefaz(htmlSefaz: string) {
  const prompt = `Você é um extrator de notas fiscais NFC-e. O usuário enviará o código HTML bruto da página da SEFAZ.
  Encontre os produtos, quantidades e preços totais.
  Retorne APENAS um JSON válido neste formato:
  {
    "mercado": "Nome do Supermercado",
    "itens": [
      {
        "id": "gere_um_id_aleatorio",
        "barras": "",
        "nome": "NOME DO PRODUTO LIMPO",
        "preco": "0.00",
        "qtd": "1",
        "categoria": "Alimentação, Limpeza, Higiene, Bebidas ou Outros"
      }
    ]
  }`;
  // Mandamos apenas uma parte do HTML para ser super rápido
  return await chamarGroq(prompt, htmlSefaz.substring(0, 30000));
}

// 3. INTELIGÊNCIA DE FOTO (OCR + GROQ)
export async function lerTextoDaImagemBase64(base64: string) {
  try {
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${base64}`);
    formData.append('language', 'por');
    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { apikey: OCR_API_KEY || '' },
      body: formData
    });
    const ocrData = await ocrRes.json();
    return ocrData.ParsedResults?.[0]?.ParsedText || "";
  } catch (e) {
    return "";
  }
}

export async function extrairNotaPorFoto(textoOcr: string) {
  const prompt = `Você extrai itens de texto bagunçado de notas fiscais.
  Retorne APENAS um JSON válido. Formato:
  {
    "mercado": "Nome do mercado",
    "itens": [
      { "id": "123", "barras": "", "nome": "Produto", "preco": "0.00", "qtd": "1", "categoria": "Alimentação" }
    ]
  }`;
  return await chamarGroq(prompt, textoOcr);
}

// 4. INTELIGÊNCIA DO HISTÓRICO (CONSULTORIA)
export async function analisarHistoricoFinanceiro(historicoTexto: string) {
  const prompt = `Você é um consultor financeiro doméstico ríspido mas amigável. Analise esses gastos do mês.
  Retorne APENAS um JSON válido:
  {
    "insight": "Frase de impacto sobre o maior gasto ou padrão.",
    "dica": "Uma dica prática de onde economizar baseado na lista."
  }`;
  return await chamarGroq(prompt, historicoTexto);
}

// 5. INTELIGÊNCIA DOS AJUSTES (ORÇAMENTO)
export async function sugerirOrcamentoInteligente(dadosTotais: string) {
  const prompt = `Analise os totais gastos por categoria. Crie um orçamento ideal para o próximo mês (tente reduzir o gasto geral em 10%).
  Retorne APENAS um JSON válido onde as chaves são as categorias exatas enviadas e os valores são números. Exemplo: {"Alimentação": "450.00", "Limpeza": "80.00"}`;
  return await chamarGroq(prompt, dadosTotais);
}