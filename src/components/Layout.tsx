import { Component, Suspense, useLayoutEffect, type ErrorInfo, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TickerProvider } from '../lib/ticker';
import { Chyron } from './Chyron';
import { CrtOverlay } from './CrtOverlay';
import { Footer } from './Footer';
import { Nav } from './Nav';
import { StatePanel } from './StatePanel';
import { SurveillanceReadout } from './SurveillanceReadout';

/** Jump to the top on route changes (never animated; hash links are left to the browser/page). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

export function PageLoading() {
  return (
    <div className="container-site py-8 sm:py-12">
      <StatePanel kind="loading" title="DECRYPTING FILE">
        Routing through seven proxies. Stand by.
      </StatePanel>
    </div>
  );
}

/** Keeps one broken page from blanking the whole shell. Reset by keying it on the pathname. */
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container-site py-8 sm:py-12">
        <div className="file-corrupted">
          <StatePanel
            kind="error"
            title="FILE CORRUPTED"
            action={
              <button type="button" className="btn btn-alert" onClick={() => window.location.reload()}>
                Reload page
              </button>
            }
          >
            This page failed to load. Could be a bad connection, could be them. Reloading usually fixes it.
          </StatePanel>
        </div>
      </div>
    );
  }
}

export function Layout() {
  const { pathname } = useLocation();
  return (
    <TickerProvider>
      <ScrollToTop />
      <div className="app-shell">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Nav />
        <main id="main" className="site-main" tabIndex={-1}>
          <PageErrorBoundary key={pathname}>
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </PageErrorBoundary>
        </main>
        <Footer />
      </div>
      <SurveillanceReadout variant="floating" className="hidden lg:block" />
      <Chyron />
      <CrtOverlay />
    </TickerProvider>
  );
}
