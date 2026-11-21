import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useUi } from './store/ui';
import Login from './pages/Login';
import AppLayout from './components/layout/AppLayout';
import { Loading } from './components/ui';

const Portfolio = lazy(() => import('./pages/Portfolio'));
const Command = lazy(() => import('./pages/Command'));
const ParkTwin = lazy(() => import('./pages/ParkTwin'));
const Gate = lazy(() => import('./pages/Gate'));
const Water = lazy(() => import('./pages/Water'));
const Energy = lazy(() => import('./pages/Energy'));
const Safety = lazy(() => import('./pages/Safety'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));

function RequireAuth({ children }) {
  const user = useUi((s) => s.user);
  return user ? children : <Navigate to="/login" replace />;
}

const page = (C) => <Suspense fallback={<Loading label="Loading…" />}><C /></Suspense>;

export default function App() {
  const user = useUi((s) => s.user);
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/portfolio" replace /> : <Login />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/portfolio" element={page(Portfolio)} />
        <Route path="/park/malur" element={page(Command)} />
        <Route path="/park/malur/twin" element={page(ParkTwin)} />
        <Route path="/park/malur/gate" element={page(Gate)} />
        <Route path="/park/malur/water" element={page(Water)} />
        <Route path="/park/malur/energy" element={page(Energy)} />
        <Route path="/park/malur/safety" element={page(Safety)} />
        <Route path="/park/malur/work-orders" element={page(WorkOrders)} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/portfolio' : '/login'} replace />} />
    </Routes>
  );
}
