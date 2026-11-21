import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdvisoryDrawer from './AdvisoryDrawer';
import ChatBot from './ChatBot';
import SiaKpiModal from './SiaKpiModal';
import IncidentBanner from './IncidentBanner';
import WorkOrderDialog from './WorkOrderDialog';
import ExportReport from './ExportReport';
import { useWorkOrders } from '../../store/workorders';
import { useLive } from '../../store/live';

export default function AppLayout() {
  const init = useLive((s) => s.init);
  const initWo = useWorkOrders((s) => s.init);
  useEffect(() => { init(); initWo(); }, [init, initWo]);
  return (
    <div className="h-full w-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col h-full">
        <Topbar />
        <IncidentBanner />
        <main className="flex-1 min-h-0 overflow-y-auto scroll-thin">
          <Outlet />
        </main>
      </div>
      <AdvisoryDrawer />
      <ChatBot />
      <SiaKpiModal />
      <WorkOrderDialog />
      <ExportReport />
    </div>
  );
}
