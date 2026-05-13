import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { SearchProvider } from "@/contexts/SearchContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { BarcodeListener } from "@/components/ui/BarcodeListener";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SocketProvider>
      <SearchProvider>
        <NotificationProvider>
          <ChatProvider>
            <div className="flex min-h-screen bg-transparent transition-colors duration-300">
              <Sidebar />
              <main className="flex-1 min-w-0 transition-[padding] duration-300">
                <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
                  <Header />
                  <div className="animate-in fade-in duration-500 pb-12 md:pb-8">
                    {children}
                  </div>

                  {/* Global Footer */}
                  <div className="mt-auto pt-8 pb-12 border-t border-[var(--border-subtle)] opacity-60">
                    <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest text-center">
                      Projetado por <strong className="text-[var(--text-main)] font-black ml-1">Space Goes Solution</strong>
                    </p>
                  </div>
                </div>
              </main>
            </div>
            <ChatPanel />
            <BarcodeListener />
          </ChatProvider>
        </NotificationProvider>
      </SearchProvider>
    </SocketProvider>
  );
}
