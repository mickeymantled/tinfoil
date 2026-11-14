import '../styles/home.css';
import { config } from '../config';
import { usePageMeta } from '../lib/usePageMeta';
import { Hero } from '../features/home/Hero';
import { Dossier } from '../features/home/Dossier';
import { FeatureExhibits } from '../features/home/FeatureExhibits';
import { LatestIncidents } from '../features/home/LatestIncidents';

export default function Home() {
  usePageMeta({ title: 'The Cyber Incident Coin', description: config.description });

  return (
    <div className="container-site py-6 sm:py-12">
      <Hero />
      <Dossier />
      <FeatureExhibits />
      <LatestIncidents />
    </div>
  );
}
