"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthService } from "@/services/auth.service";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Logo } from "@/components/common/Logo";

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { login: authLogin } = useAuth();
  const { error: toastError } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState("");

  const [isLogged, setIsLogged] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorCode("Digite seu e-mail para recuperação.");
      return;
    }
    
    try {
      setLoading(true);
      setErrorCode("");
      await AuthService.forgotPassword(email.toLowerCase());
      setForgotSuccess(true);
    } catch (err: any) {
      setErrorCode(err.backendMessage || "Não foi possível solicitar redefinição.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setErrorCode("");
      const res = await authLogin(email.toLowerCase(), password);
      setIsLogged(true);
      
      // Determine the first permitted route
      let redirectPath = "/inicio";
      const user = res.user;

      if (user.cargo !== 'admin') {
        const ROUTES_PRIORITY = [
          { p: "dashboard",        r: "/dashboard" },
          { p: "equipamentos",     r: "/equipamentos" },
          { p: "colaboradores",    r: "/colaboradores" },
          { p: "movimentacoes",    r: "/movimentacoes" },
          { p: "solicitacoes",     r: "/solicitacoes" },
          { p: "rede",             r: "/rede" },
          { p: "auditoria",        r: "/auditoria" },
          { p: "rastreabilidade",  r: "/rastreabilidade" },
          { p: "investimentos",    r: "/investimentos" },
          { p: "diagnosticos",     r: "/diagnosticos" },
          { p: "calendario",       r: "/calendario" },
          { p: "configuracoes",    r: "/configuracoes" },
        ];

        const firstPermitted = ROUTES_PRIORITY.find(item => {
          const p = user.permissoes?.[item.p];
          if (p === true) return true;
          if (p && typeof p === 'object' && (p as any).view) return true;
          return false;
        });

        if (firstPermitted) {
          redirectPath = firstPermitted.r;
        }
      }

      // Brief delay to show the opening animation
      setTimeout(() => {
        router.push(redirectPath);
      }, 1000);
    } catch (err: any) {
      setErrorCode(err.backendMessage || "Login falhou. Verifique suas credenciais.");
    } finally {
      if (!isLogged) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6 font-sans overflow-hidden relative transition-colors duration-200">
      {/* Visual Identity / Theme Toggle */}
      <div className="absolute top-10 right-10 z-50 flex items-center gap-6">
        <button 
           onClick={toggleTheme}
           className="w-12 h-12 rounded-2xl bg-surface border border-border-subtle/20 shadow-nm-flat flex items-center justify-center text-brand transition-all group"
           title={theme === 'dark' ? 'Ativar Modo Luz' : 'Ativar Modo Noturno'}
        >
          {theme === 'dark' ? (
            <i className="fa-solid fa-sun text-lg" />
          ) : (
            <i className="fa-solid fa-moon text-lg" />
          )}
        </button>
      </div>


      {/* Blue System Background (Clean) */}
      <div className="absolute inset-0 z-0 bg-bg pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 w-full max-w-[440px]"
      >
        {/* Neumorphic Premium Card */}
        <div className="bg-surface rounded-[3.5rem] p-10 border border-border-subtle/20 shadow-nm-flat relative overflow-hidden group">
          {/* Subtle Ambient Glows */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand/10 blur-[100px] rounded-full pointer-events-none" />

          {/* Logo & Branding */}
          <div className="flex flex-col items-center mb-12 relative z-10">
            <Logo size={80} className="mb-6 drop-shadow-[0_0_20px_rgba(59,130,246,0.2)]" />
            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tight mb-2 select-none flex items-center justify-center gap-1.5 leading-tight text-center">
                <span className="text-strong text-2xl">INVENTÁRIO</span>
                <span className="text-brand text-2xl">E REDE</span>
              </h1>
              <div className="flex items-center gap-3 justify-center mb-2">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-brand/30 to-transparent" />
                <p className="text-[10px] text-muted font-black tracking-[0.4em] uppercase opacity-90">Security Portal</p>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent via-brand/30 to-transparent" />
              </div>
            </div>
          </div>

          {errorCode && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="bg-error/10 border border-error/20 text-error px-4 py-4 rounded-[1.5rem] mb-8 text-[11px] font-black uppercase tracking-tight flex items-center gap-3 shadow-nm-inset"
            >
              <i className="fa-solid fa-triangle-exclamation"></i>
              {errorCode}
            </motion.div>
          )}
          
          {forgotSuccess ? (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="text-center space-y-6 relative z-10"
             >
               <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-success/20">
                 <i className="fa-solid fa-envelope-circle-check text-2xl text-success"></i>
               </div>
               <h3 className="text-sm font-black text-strong uppercase tracking-widest">Protocolo Enviado</h3>
               <p className="text-xs text-muted leading-relaxed">
                 Se o e-mail <br/><span className="text-brand font-bold">{email}</span><br/> estiver registrado, 
                 você receberá um link seguro para redefinir sua chave de acesso em breve.
               </p>
               <button 
                 onClick={() => {
                   setIsForgotMode(false);
                   setForgotSuccess(false);
                   setErrorCode("");
                   setEmail("");
                 }}
                 className="mt-6 text-[10px] font-black text-brand uppercase tracking-widest hover:text-brand/80 transition-colors"
               >
                 <i className="fa-solid fa-arrow-left mr-2"></i> RETORNAR AO LOGIN
               </button>
             </motion.div>
          ) : isForgotMode ? (
            <form onSubmit={handleForgotSubmit} className="space-y-6 relative z-10 font-jakarta">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">E-mail de Recuperação</label>
                <div className="relative group">
                  <i className="fa-solid fa-envelope absolute left-5 top-1/2 -translate-y-1/2 text-muted opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="USUARIO@INVENTARIO.REDE" 
                    required
                    className="w-full pl-12 pr-6 py-4.5 bg-surface-soft border border-border-subtle/20 rounded-[1.5rem] text-xs font-black text-strong placeholder:text-muted/30 focus:outline-none shadow-nm-inset focus:ring-4 focus:ring-brand/5 transition-all uppercase tracking-tight"
                  />
                </div>
                <p className="text-[10px] text-muted text-center px-4 pt-2">Enviaremos um link de acesso único válido por 1 hora.</p>
              </div>

              <div className="pt-2 flex flex-col gap-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-brand text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-[1.5rem] shadow-nm-flat hover:bg-brand/90 disabled:opacity-50 flex items-center justify-center gap-3 transition-colors"
                >
                  {loading ? <i className="fa-solid fa-circle-notch fa-spin text-lg" /> : <> <i className="fa-solid fa-paper-plane text-xs"></i> ENVIAR LINK SECRETO </>}
                </button>
                <button 
                  type="button"
                  onClick={() => { setIsForgotMode(false); setErrorCode(""); }}
                  className="text-[10px] font-black text-muted uppercase tracking-[0.2em] hover:text-strong transition-colors"
                >
                  Cancelar e Voltar
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6 relative z-10 font-jakarta">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-2">Identificação de Operador</label>
                <div className="relative group">
                  <i className="fa-solid fa-user-astronaut absolute left-5 top-1/2 -translate-y-1/2 text-muted opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="USUARIO@INVENTARIO.REDE" 
                    required
                    className="w-full pl-12 pr-6 py-4.5 bg-surface-soft border border-border-subtle/20 rounded-[1.5rem] text-xs font-black text-strong placeholder:text-muted/30 focus:outline-none shadow-nm-inset focus:ring-4 focus:ring-brand/5 transition-all uppercase tracking-tight"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center px-2">
                  <label className="block text-[10px] font-black text-muted uppercase tracking-[0.2em]">Chave de Segurança</label>
                  <button type="button" onClick={() => { setIsForgotMode(true); setErrorCode(""); }} className="text-[9px] font-black text-brand hover:text-brand/80 uppercase tracking-widest transition-colors">Esqueci a Chave</button>
                </div>
                <div className="relative group">
                  <i className="fa-solid fa-key absolute left-5 top-1/2 -translate-y-1/2 text-muted opacity-30 group-focus-within:text-brand group-focus-within:opacity-100 transition-all" />
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
              
              <button 
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-brand text-white font-black text-[11px] uppercase tracking-[0.25em] rounded-[1.5rem] shadow-nm-flat hover:bg-brand/90 disabled:opacity-50 flex items-center justify-center gap-3 group mt-10 relative overflow-hidden"
              >
                {loading ? (
                  <i className="fa-solid fa-circle-notch fa-spin text-lg" />
                ) : isLogged ? (
                  <span className="flex items-center gap-2">AUTENTICANDO...</span>
                ) : (
                  <>
                    <i className="fa-solid fa-bolt text-xs" />
                    ATIVAR SISTEMA
                  </>
                )}
              </button>
            </form>
          )}
          
          <div className="mt-12 flex flex-col items-center gap-5 relative z-10 border-t border-border-subtle/20 pt-8">
            <div className="flex items-center gap-4 text-muted opacity-40">
               <i className="fa-solid fa-shield-halved text-sm" />
               <span className="text-[9px] font-black uppercase tracking-[0.3em] text-center">Protocolo de Segurança Ativo</span>
               <i className="fa-solid fa-satellite text-sm" />
            </div>
            <p className="text-[9px] text-muted font-black uppercase tracking-widest">
              Projetado por <span className="text-strong">Space Goes Solution</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
