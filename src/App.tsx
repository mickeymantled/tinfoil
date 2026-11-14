import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import NotFound from './pages/NotFound';

const Home = lazy(() => import('./pages/Home'));
const HatGenerator = lazy(() => import('./pages/HatGenerator'));
const IncidentFeed = lazy(() => import('./pages/IncidentFeed'));
const SurvivalGuide = lazy(() => import('./pages/SurvivalGuide'));

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
