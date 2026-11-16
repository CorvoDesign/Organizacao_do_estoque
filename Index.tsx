import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSync } from '@/hooks/useTeamData';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/app/Sidebar';
import { TasksView } from '@/components/app/TasksView';
import { CalendarView } from '@/components/app/CalendarView';
import { StockView } from '@/components/app/StockView';
import { PendingApproval } from '@/components/app/PendingApproval';
import { WallpaperBackdrop } from '@/components/app/WallpaperBackdrop';

function AppLayout() {
  const { state } = useApp();
  const { wallpaper, activeView, sidebarOpen } = state;
  useRealtimeSync();
  const [shown, setShown] = useState(wallpaper);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishFade = useCallback(() => {
    if (fallbackRef.current) clearTimeout(fallbackRef.current);
    fallbackRef.current = null;
    if (incoming) setShown(incoming);
    setIncoming(null);
    setIncomingVisible(false);
  }, [incoming]);

  useEffect(() => {
    if (wallpaper === shown || wallpaper === incoming) return;
    let cancelled = false;
    const img = new Image();
    img.src = wallpaper;
    // Fade in only once the picture is decoded, or the layer fades in empty and then pops.
    img.decode().catch(() => undefined).then(() => {
      if (cancelled) return;
      if (incoming) setShown(incoming);
      setIncoming(wallpaper);
      setIncomingVisible(false);
    });
    return () => {
      cancelled = true;
    };
  }, [wallpaper, shown, incoming]);

  useEffect(() => {
    if (!incoming) return;
    // Two frames so the layer is painted at opacity 0 before the transition starts.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setIncomingVisible(true));
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [incoming]);

  useEffect(() => {
    if (!incomingVisible) return;
    // transitionend does not fire in a hidden tab, so the swap cannot depend on it alone.
    fallbackRef.current = setTimeout(finishFade, 700);
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    };
  }, [incomingVisible, finishFade]);

  return (
    <div className="h-screen w-screen overflow-hidden relative transition-colors duration-300">
      {/* Wallpaper layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${shown})` }}
      />
      {incoming && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
          style={{ backgroundImage: `url(${incoming})`, opacity: incomingVisible ? 1 : 0 }}
          onTransitionEnd={finishFade}
        />
      )}

      {/* App shell */}
      <div className="relative z-10 h-full flex overflow-y-auto">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className={cn("flex-1 flex justify-center min-w-0 p-4 md:p-6 lg:p-8 transition-all duration-300", sidebarOpen ? "md:ml-[220px]" : "md:ml-0")}>
          <div className="w-full max-w-[720px] pb-10">
            {activeView === 'tasks' && <TasksView />}
            {activeView === 'calendar' && <CalendarView />}
            {activeView === 'stock' && <StockView />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Only signed-in, approved team members reach the app. */
const Index = () => {
  const { session, loading, rolesLoading, isMember, roles } = useAuth();
  if (loading) return <WallpaperBackdrop><p className="type-body-md text-primary-foreground">Carregando…</p></WallpaperBackdrop>;
  if (!session) return <Navigate to="/entrar" replace />;
  if (rolesLoading && roles.length === 0) return <WallpaperBackdrop><p className="type-body-md text-primary-foreground">Carregando…</p></WallpaperBackdrop>;
  if (!isMember) return <PendingApproval />;
  return <AppLayout />;
};

export default Index;
