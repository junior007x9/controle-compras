import { createClient } from "@libsql/client/web";

// 🔥 SEGURANÇA MÁXIMA: O aplicativo agora vai buscar as chaves ao Cofre da Expo de forma invisível!
const urlTurso = process.env.EXPO_PUBLIC_TURSO_URL;
const tokenTurso = process.env.EXPO_PUBLIC_TURSO_TOKEN;

export const turso = createClient({
  url: urlTurso as string,
  authToken: tokenTurso as string,
});
