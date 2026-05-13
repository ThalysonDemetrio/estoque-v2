"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import { motion } from "framer-motion";
import { Logo } from "@/components/common/Logo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Token inválido ou ausente.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve possuir pelo mínimo 6 caracteres.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await AuthService.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (err: any) {
      setError(err.backendMessage || "Erro ao redefinir a senha. O token pode estar expirado ou já foi utilizado.");
    } finally {
      if(!success) setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <i className="fa-solid fa-triangle-exclamation text-error text-4xl mb-4"></i>
        <h2 className="text-sm text-strong font-black uppercase tracking-widest">Acesso Negado</h2>
        <p className="text-xs text-muted">Link de recuperação inválido ou inexistente.</p>
        <button 
          onClick={() => router.push("/")} 
          className="mt-6 text-[10px] text-brand uppercase font-black tracking-widest hover:text-brand/80 transition-colors"
        >
          <i className="fa-solid fa-arrow-left mr-2"></i> Retornar ao Login
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6"
      >
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20">
          <i className="fa-solid fa-check text-2xl text-success"></i>
        </div>
        <h3 className="text-sm font-black text-strong uppercase tracking-widest">Chave Atualizada</h3>
        <p className="text-xs text-muted leading-relaxed">Sua credencial de segurança foi alterada com sucesso.</p>
        <p className="text-[10px] text-brand font-black uppercase tracking-widest animate-pulse">
           Redirecionando para o login...
        </p>
      </motion.div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-xl font-black text-strong uppercase tracking-widest mb-2">Redefinir Chave</h2>
        <p className="text-[10px] text-muted uppercase tracking-[0.2em] px-4">Insira abaixo a sua nova credencial de segurança. Ela substituirá a anterior permanentemente.</p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          className="bg-error/10 border border-error/20 text-error px-4 py-4 rounded-[1.5rem] mb-8 text-[11px] font-black uppercase tracking-tight flex items-center gap-3 shadow-nm-inset"
        >
          <i className="fa-solid fa-triangle-exclamation"></i>
          {error}
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 relative z-10 font-jakarta">
        <div className="space-y-3">
          <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Nova Chave de Segurança</label>
          <div className="relative group">
            <i className="fa-solid fa-lock absolute left-5 top-1/2 -translate-y-1/2 text-muted opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required
              className="w-full pl-12 pr-6 py-4.5 bg-surface-soft border border-border-subtle/20 rounded-[1.5rem] text-xs font-black text-strong placeholder:text-muted/30 focus:outline-none shadow-nm-inset focus:ring-4 focus:ring-brand/5 transition-all"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Confirmar Nova Chave</label>
          <div className="relative group">
            <i className="fa-solid fa-lock-keyhole absolute left-5 top-1/2 -translate-y-1/2 text-muted opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••" 
              required
              className="w-full pl-12 pr-6 py-4.5 bg-surface-soft border border-border-subtle/20 rounded-[1.5rem] text-xs font-black text-strong placeholder:text-muted/30 focus:outline-none shadow-nm-inset focus:ring-4 focus:ring-brand/5 transition-all"
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-brand text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-[1.5rem] shadow-nm-flat hover:bg-brand/90 disabled:opacity-50 flex items-center justify-center gap-3 group mt-10 relative overflow-hidden transition-all"
        >
          {loading ? (
            <i className="fa-solid fa-circle-notch fa-spin text-lg" />
          ) : (
            <>
              <i className="fa-solid fa-shield-check text-xs" />
              ATUALIZAR CREDENCIAL
            </>
          )}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6 font-sans overflow-hidden relative transition-colors duration-200">
      <div className="absolute inset-0 z-0 bg-bg pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 w-full max-w-[440px]"
      >
        <div className="bg-surface rounded-[3.5rem] p-10 border border-border-subtle/20 shadow-nm-flat relative overflow-hidden group">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="flex flex-col items-center mb-10 relative z-10">
            <Logo size={65} className="mb-4 drop-shadow-[0_0_20px_rgba(59,130,246,0.2)]" />
          </div>

          <div className="relative z-10">
            <Suspense fallback={<div className="text-center py-10"><i className="fa-solid fa-circle-notch fa-spin text-brand text-2xl"></i></div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>

          <div className="mt-12 flex flex-col items-center gap-5 relative z-10 border-t border-border-subtle/20 pt-8">
            <div className="flex items-center gap-4 text-muted opacity-40">
               <i className="fa-solid fa-shield-halved text-sm" />
               <span className="text-[9px] font-black uppercase tracking-[0.3em] text-center">Protocolo de Segurança</span>
               <i className="fa-solid fa-lock text-sm" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
