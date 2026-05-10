import type { MetaFunction } from 'react-router';
import LoginPage from '../pages/login';

export const meta: MetaFunction = () => [
  { title: 'Sign in — Istiqāmah' },
  { name: 'description', content: 'Sign in to sync your prayer-anchored tasks across devices.' },
];

export default LoginPage;
