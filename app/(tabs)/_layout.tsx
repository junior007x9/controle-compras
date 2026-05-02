import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Colors } from "../../constants/Colors";
import { useAuthStore } from "../../store/useAuthStore";

// 🔥 1. MANTEMOS O CONGELAMENTO AQUI (POR SEGURANÇA)
SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

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
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarStyle: {
          // Se não estiver logado, a barra de baixo desaparece
          display: isLogado ? "flex" : "none",
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
          title: "Lista",
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
