import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "../../constants/Colors";
import { useAuthStore } from "../../store/useAuthStore";
import { useThemeStore } from "../../store/useThemeStore"; // 🔥 TEMA GLOBAL ADICIONADO

// 🔥 1. MANTEMOS O CONGELAMENTO AQUI (POR SEGURANÇA)
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  // 🔥 GESTÃO DE TEMA ATUALIZADA
  const systemTheme = useColorScheme() ?? "light";
  const { temaAtivo } = useThemeStore();
  const theme = temaAtivo === "system" ? systemTheme : temaAtivo;
  const color = Colors[theme];

  // 🔥 2. ESTADO DE PRONTIDÃO: Começa como falso
  const [isReady, setIsReady] = useState(false);

  // Verifica os dados do utilizador
  const { usuario, familiaId } = useAuthStore();
  const isLogado = usuario !== null && familiaId !== null;

  useEffect(() => {
    // 🔥 3. O SEGREDO: Verificamos se já carregou ou se precisamos de esperar
    const checkHydration = () => {
      if (useAuthStore.persist.hasHydrated()) {
        setIsReady(true);
      } else {
        // Se ainda não carregou, criamos um "ouvinte" que avisa quando terminar
        const unsub = useAuthStore.persist.onFinishHydration(() => {
          setIsReady(true);
        });
        return unsub;
      }
    };

    const unsubHydrate = checkHydration();
    return () => {
      if (unsubHydrate) unsubHydrate();
    };
  }, []);

  useEffect(() => {
    // 🔥 4. LIBERTAÇÃO: Assim que estiver pronto, escondemos a tela escura
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // 🔥 5. PROTEÇÃO: Enquanto não houver certeza dos dados, não mostra nada (mantém o splash)
  if (!isReady) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: color.tint, // 🔥 Usa a cor principal do seu tema
        tabBarInactiveTintColor: color.textSecondary, // 🔥 Cor dos ícones inativos
        headerShown: false,
        tabBarStyle: {
          display: isLogado ? "flex" : "none",
          backgroundColor: color.card, // 🔥 Fundo da barra obedece ao Modo Escuro/Claro
          borderTopColor: color.border, // 🔥 Linha divisória sutil adaptável
          elevation: 0, // Remove a sombra genérica no Android para um visual mais limpo e flat
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Carrinho",
          tabBarIcon: ({ color }) => (
            <Ionicons name="cart" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="lista"
        options={{
          title: "Planejar", // 🔥 Mudei de "Lista" para "Planejar" para ficar mais premium e combinar com o título da tela
          tabBarIcon: ({ color }) => (
            <Ionicons name="list" size={24} color={color} />
          ),
          href: isLogado ? "/lista" : null,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color }) => (
            <Ionicons name="time" size={24} color={color} />
          ),
          href: isLogado ? "/historico" : null,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={24} color={color} />
          ),
          href: isLogado ? "/ajustes" : null,
        }}
      />
    </Tabs>
  );
}