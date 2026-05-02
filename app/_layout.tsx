import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

// 1. Congela a tela preta / logótipo
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // 2. Criamos um "estado" para a tela saber quando pode abrir
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 3. O Detetive: Fica a verificar a cada 50 milissegundos se a memória já carregou
    const verificarMemoria = setInterval(() => {
      if (useAuthStore.persist.hasHydrated()) {
        setIsReady(true); // Memória carregada!
        clearInterval(verificarMemoria); // Para o detetive
      }
    }, 50);

    return () => clearInterval(verificarMemoria);
  }, []);

  useEffect(() => {
    // 4. Assim que o estado "isReady" for verdadeiro, a tela preta desaparece!
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Se ainda não estiver pronto, não tenta desenhar a aplicação (evita bugs)
  if (!isReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
