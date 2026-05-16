import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Topbar } from './components/Topbar';
import { Sidebar } from './components/Sidebar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ScannerOverlay } from './components/ScannerOverlay';
import { Planner2D } from './components/Planner2D';
import { Visualizer3D } from './components/Visualizer3D';

function App() {
  const theme = useStore(state => state.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app-container">
      <Topbar />
      
      <div className="main-content">
        <Sidebar />
        <PropertiesPanel />
        
        <Planner2D />
        <Visualizer3D />
      </div>

      <ScannerOverlay />
    </div>
  );
}

export default App;
