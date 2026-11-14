import { lazy, type ComponentType } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import NotFound from './pages/NotFound';

const RELOAD_FLAG = 'tinfoil-hat:chunk-reload';

/**
 * Lazy-load a page, recovering from a stale tab. After a redeploy the hashed
 * page files change, so a tab opened before the deploy cannot fetch a page it
 * has not visited yet. Reload once to pick up the new build; if that does not
 * help, let the error boundary show its message instead of looping.
 */
function lazyPage<T extends { default: ComponentType }>(load: () => Promise<T>) {
  return lazy(async () => {
    try {
      const mod = await load();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // storage unavailable: nothing to clear
      }
      return mod;
    } catch (err) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        sessionStorage.setItem(RELOAD_FLAG, '1');
      } catch {
        // Without storage we cannot tell whether we already tried, so do not risk a reload loop.
      }
      if (alreadyReloaded) throw err;
      window.location.reload();
      // Never resolves: the page is reloading.
      return new Promise<T>(() => {});
    }
  });
}

// Keep in sync with CLIENT_ROUTES in server/app.ts.
const Home = lazyPage(() => import('./pages/Home'));
const HatGenerator = lazyPage(() => import('./pages/HatGenerator'));
const IncidentFeed = lazyPage(() => import('./pages/IncidentFeed'));
const SurvivalGuide = lazyPage(() => import('./pages/SurvivalGuide'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="hat-generator" element={<HatGenerator />} />
        <Route path="incidents" element={<IncidentFeed />} />
        <Route path="survival-guide" element={<SurvivalGuide />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
