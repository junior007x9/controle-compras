const { withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidFix(config) {
  // 1. CORRIGE O MANIFEST (Evita o Erro 1 e Destranca o Reconhecimento de Voz no Android 11+)
  config = withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    
    // --- PARTE A: Correção original do AppComponentFactory ---
    if (!androidManifest.$['xmlns:tools']) {
      androidManifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = androidManifest.application[0];
    
    if (app.$['tools:replace']) {
      if (!app.$['tools:replace'].includes('android:appComponentFactory')) {
        app.$['tools:replace'] += ',android:appComponentFactory';
      }
    } else {
      app.$['tools:replace'] = 'android:appComponentFactory';
    }

    app.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';

    // --- PARTE B: O SEGREDO DO MICROFONE (XML Correto para Android 11+) ---
    // O Android aceita APENAS UMA tag <queries>. Se criarmos várias, ele ignora.
    if (!androidManifest.queries || !Array.isArray(androidManifest.queries)) {
      androidManifest.queries = [{}];
    }
    
    const queriesBlock = androidManifest.queries[0];

    // 1. Injetar a ação do Reconhecimento de Voz
    if (!queriesBlock.intent) queriesBlock.intent = [];
    queriesBlock.intent.push({
      action: [{ $: { "android:name": "android.speech.RecognitionService" } }]
    });

    // 2. Injetar o pacote direto do Google App (Garante que telemóveis Samsung/Xiaomi achem a IA)
    if (!queriesBlock.package) queriesBlock.package = [];
    queriesBlock.package.push({
      $: { "android:name": "com.google.android.googlequicksearchbox" }
    });

    return config;
  });

  // 2. LIGA O JETIFIER À FORÇA BRUTA (Evita o erro de Classes Duplicadas)
  config = withGradleProperties(config, (config) => {
    // Removemos os antigos se existirem para não dar conflito
    config.modResults = config.modResults.filter(
      item => item.key !== 'android.enableJetifier' && item.key !== 'android.useAndroidX'
    );
    
    // Injetamos a conversão automática de bibliotecas velhas
    config.modResults.push({ type: 'property', key: 'android.useAndroidX', value: 'true' });
    config.modResults.push({ type: 'property', key: 'android.enableJetifier', value: 'true' });
    
    return config;
  });

  return config;
};