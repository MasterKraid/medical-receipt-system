import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

function ReloadPrompt() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('Service Worker registered:', r);
      if (r) {
        registrationRef.current = r;
        // Trigger initial check on load/refresh
        r.update().catch(console.error);
      }
    },
    onRegisterError(error) {
      console.log('Service Worker registration error:', error);
    },
  });

  useEffect(() => {
    const handleReopen = () => {
      if (document.visibilityState === 'visible' && registrationRef.current) {
        console.log('App reopened/focused, checking for service worker updates...');
        registrationRef.current.update().catch(console.error);
      }
    };

    document.addEventListener('visibilitychange', handleReopen);
    window.addEventListener('focus', handleReopen);

    return () => {
      document.removeEventListener('visibilitychange', handleReopen);
      window.removeEventListener('focus', handleReopen);
    };
  }, []);

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (offlineReady || needRefresh) {
    return (
      <div className="fixed right-0 bottom-0 m-4 p-4 border rounded-lg shadow-lg bg-white z-50 animate-fade-in-up">
        <div className="flex items-start gap-4">
          <div className="flex-grow">
            {needRefresh ? (
              <span className="text-sm text-gray-800">New content available, click on reload button to update.</span>
            ) : (
              <span className="text-sm text-gray-800">App is ready to work offline!</span>
            )}
          </div>
          <div className="flex gap-2">
            {needRefresh && (
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 transition-colors"
                onClick={() => updateServiceWorker(true)}
              >
                Reload
              </button>
            )}
            <button className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm transition-colors" onClick={() => close()}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default ReloadPrompt;
