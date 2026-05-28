import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store'; 
import { auth } from '../firebaseConfig'; 
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { Alert } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { turso } from '../database'; // 🔥 BANCO DE DADOS IMPORTADO AQUI

GoogleSignin.configure({
  webClientId: '983322953388-1mb5pquf9oimaga5mr85juk4j8sf1an7.apps.googleusercontent.com',
});

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try { return (await SecureStore.getItemAsync(name)) || null; } catch (e) { return null; }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try { await SecureStore.setItemAsync(name, value); } catch (e) {}
  },
  removeItem: async (name: string): Promise<void> => {
    try { await SecureStore.removeItemAsync(name); } catch (e) {}
  },
};

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  foto: string;
}

interface AuthState {
  usuario: UserProfile | null;
  familiaId: string | null;
  setUsuario: (user: UserProfile | null) => void;
  entrarNaFamiliaComSenha: (codigo: string, senha?: string) => Promise<boolean>;
  criarNovaFamiliaComSenha: (senha?: string) => Promise<boolean>;
  sairDaFamilia: () => Promise<void>;
  fazerLogout: () => void;
  entrarOuRegistar: (email: string, senha: string) => Promise<void>;
  entrarComGoogle: () => Promise<void>;
}

// 🔥 MOTOR DE SINCRONIZAÇÃO GLOBAL (VINCULA O EMAIL À FAMÍLIA)
const sincronizarBancoDeDados = async (uid: string, email: string, set: any) => {
  try {
    await turso.execute(`CREATE TABLE IF NOT EXISTS familias_globais (codigo TEXT PRIMARY KEY, senha TEXT)`);
    await turso.execute(`CREATE TABLE IF NOT EXISTS usuarios_perfis (uid TEXT PRIMARY KEY, email TEXT, familia_id TEXT)`);

    const res = await turso.execute({
      sql: "SELECT familia_id FROM usuarios_perfis WHERE uid = ?",
      args: [uid]
    });

    if (res.rows.length > 0) {
      // Utilizador já existe! Restaura a família dele automaticamente
      const familiaSalva = res.rows[0].familia_id;
      if (familiaSalva) set({ familiaId: String(familiaSalva) });
    } else {
      // Novo utilizador! Regista-o com família em branco
      await turso.execute({
        sql: "INSERT INTO usuarios_perfis (uid, email, familia_id) VALUES (?, ?, NULL)",
        args: [uid, email]
      });
    }
  } catch (error) { console.log("Erro ao sincronizar perfil:", error); }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuario: null,
      familiaId: null,
      
      setUsuario: (user) => set({ usuario: user }),
      
      // 🔥 ENTRAR NUMA FAMÍLIA COM SEGURANÇA
      entrarNaFamiliaComSenha: async (codigo: string, senha?: string) => {
        const uid = get().usuario?.uid;
        if (!uid) return false;

        try {
          const res = await turso.execute({
            sql: "SELECT * FROM familias_globais WHERE codigo = ?",
            args: [codigo]
          });

          if (res.rows.length === 0) {
            Alert.alert("Aviso", "Este código de família não existe.");
            return false;
          }

          const familia = res.rows[0];
          
          if (familia.senha && familia.senha !== senha) {
            Alert.alert("Acesso Negado", "A palavra-passe desta família está incorreta.");
            return false;
          }

          // Sucesso! Vincula o utilizador a esta família no servidor
          await turso.execute({
            sql: "UPDATE usuarios_perfis SET familia_id = ? WHERE uid = ?",
            args: [codigo, uid]
          });

          set({ familiaId: codigo });
          return true;
        } catch (error) {
          Alert.alert("Erro", "Problema de conexão ao verificar a família.");
          return false;
        }
      },

      // 🔥 CRIAR UMA FAMÍLIA À PROVA DE CÓDIGOS REPETIDOS
      criarNovaFamiliaComSenha: async (senha?: string) => {
        const uid = get().usuario?.uid;
        if (!uid) return false;

        let codigoUnico = "";
        let tentativas = 0;
        
        while (tentativas < 5) {
          const tempCodigo = Math.random().toString(36).substring(2, 8).toUpperCase();
          try {
            await turso.execute({
              sql: "INSERT INTO familias_globais (codigo, senha) VALUES (?, ?)",
              args: [tempCodigo, senha || null]
            });
            codigoUnico = tempCodigo;
            break; // A tabela aceitou! O código é 100% único no mundo.
          } catch (error) {
            tentativas++; // UNIQUE falhou (código repetido), tenta outro!
          }
        }

        if (!codigoUnico) {
          Alert.alert("Erro", "Servidores ocupados. Não foi possível gerar um código único.");
          return false;
        }

        await turso.execute({
          sql: "UPDATE usuarios_perfis SET familia_id = ? WHERE uid = ?",
          args: [codigoUnico, uid]
        });

        set({ familiaId: codigoUnico });
        return true;
      },
      
      // 🔥 SAIR DA FAMÍLIA E APAGAR O VÍNCULO NO SERVIDOR
      sairDaFamilia: async () => {
        const uid = get().usuario?.uid;
        if (uid) {
          try {
            await turso.execute({
              sql: "UPDATE usuarios_perfis SET familia_id = NULL WHERE uid = ?",
              args: [uid]
            });
          } catch(e) {}
        }
        set({ familiaId: null });
      },

      fazerLogout: async () => {
        try {
          await firebaseSignOut(auth);
          await GoogleSignin.signOut(); 
          set({ usuario: null, familiaId: null });
        } catch (error) {}
      },

      entrarOuRegistar: async (email, senha) => {
        if (!email || !senha || senha.length < 6) return Alert.alert("Aviso", "Preencha um e-mail válido e uma senha (min 6 caracteres).");

        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, senha);
          const user = userCredential.user;
          
          await sincronizarBancoDeDados(user.uid, user.email || '', set);
          
          set({ 
            usuario: { uid: user.uid, nome: user.email?.split('@')[0] || 'Utilizador', email: user.email || '', foto: `https://ui-avatars.com/api/?name=${user.email || 'U'}&background=random` } 
          });
        } catch (error: any) {
          if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
              const newUserCredential = await createUserWithEmailAndPassword(auth, email, senha);
              const newUser = newUserCredential.user;
              
              await sincronizarBancoDeDados(newUser.uid, newUser.email || '', set);
              
              set({ 
                usuario: { uid: newUser.uid, nome: newUser.email?.split('@')[0] || 'Novo Utilizador', email: newUser.email || '', foto: `https://ui-avatars.com/api/?name=${newUser.email || 'U'}&background=random` } 
              });
            } catch (createError: any) { Alert.alert("Erro ao criar conta", createError.message); }
          } else { Alert.alert("Erro de Autenticação", error.message); }
        }
      },

      entrarComGoogle: async () => {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          let idToken = response?.data?.idToken || (response as any)?.idToken;

          if (!idToken) return Alert.alert("Erro", "O Google não devolveu a chave de segurança.");

          const googleCredential = GoogleAuthProvider.credential(idToken);
          const userCredential = await signInWithCredential(auth, googleCredential);
          const user = userCredential.user;

          await sincronizarBancoDeDados(user.uid, user.email || '', set);

          set({
            usuario: { uid: user.uid, nome: user.displayName || user.email?.split('@')[0] || 'Utilizador Google', email: user.email || '', foto: user.photoURL || `https://ui-avatars.com/api/?name=${user.email || 'G'}&background=random` }
          });
        } catch (error: any) { console.log(error); }
      }

    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage), 
    }
  )
);