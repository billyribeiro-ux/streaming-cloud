import { useEffect } from 'react';
import { ToastProvider, ToastViewport } from '@radix-ui/react-toast';

import LazyRoutes from './routes/LazyRoutes';
import { useAuthStore } from './stores/authStore';

function App() {
  const loadUser = useAuthStore((state) => state.loadUser);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <ToastProvider swipeDirection="right">
      <LazyRoutes />
      <ToastViewport className="fixed bottom-0 right-0 z-50 flex max-w-[420px] flex-col gap-2 p-6" />
    </ToastProvider>
  );
}

export default App;
