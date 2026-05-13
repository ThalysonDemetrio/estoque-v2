"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthService } from "@/services/auth.service";
import { api } from "@/lib/api-client";

interface User {
  userId: string;
  email: string;
  nome: string;
  cargo: string;
  avatar: string | null;
  permissoes: Record<string, boolean | { view?: boolean; edit?: boolean }>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  hasPermission: (permission: string, action?: "view" | "edit") => boolean;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { nome?: string; avatar?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!api.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error("Erro ao carregar usuario:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await AuthService.login(email, password);
    if (data?.user) {
      setUser(data.user);
    }
    return data;
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    window.location.href = "/";
  };

  const hasPermission = (permission: string, action: "view" | "edit" = "view") => {
    if (!user) return false;
    if (user.cargo === "admin") return true;

    const p = user.permissoes?.[permission];
    if (p === undefined) return false;

    if (typeof p === "boolean") {
      return p && action === "view"; // Retrocompatibilidade: boolean = só ver
    }
    
    return !!(p as any)[action];
  };

  const updateProfile = async (data: { nome?: string; avatar?: string }) => {
    try {
      const updatedUser = await AuthService.updateProfile(data);
      if (updatedUser) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error("Erro ao atualizar perfil:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
