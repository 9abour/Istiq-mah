import type { Route } from './+types/home';
import HomePage from '../pages/home';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Istiqāmah' },
    { name: 'description', content: 'Track your day by prayer time' },
  ];
}

export default function Home() {
  return <HomePage />;
}
