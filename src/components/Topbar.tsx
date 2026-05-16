import React from 'react';
import { useStore } from '../store/useStore';
import { Box, Layers, PlaySquare, Sun, Moon } from 'lucide-react';

export const Topbar: React.FC = () => {
  const { phase, setPhase, theme, setTheme } = useStore();

  return (
    <div className="topbar glass-panel">
      <div className="brand">
        <Box className="brand-icon" size={28} />
        <span>PlanCraft 3D</span>
      </div>

      <div className="mode-switcher">
        <button 
          className={`mode-btn ${phase === '2d' ? 'active' : ''}`}
          onClick={() => setPhase('2d')}
        >
          <Layers size={16} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Floor Planner
        </button>
        <button 
          className={`mode-btn ${phase === '3d' ? 'active' : ''}`}
          onClick={() => setPhase('3d')}
        >
          <PlaySquare size={16} style={{ display: 'inline-block', marginRight: 6, verticalAlign: 'text-bottom' }} />
          3D Visualizer
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          className="tool-btn" 
          style={{ padding: '8px', borderRadius: '50%' }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
};
