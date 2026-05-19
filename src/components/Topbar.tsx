import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Layers, PlaySquare, Sun, Moon, Settings } from 'lucide-react';
import { ApiSettingsModal } from './ApiSettingsModal';

export const Topbar: React.FC = () => {
  const { phase, setPhase, theme, setTheme } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className="topbar" style={{ justifyContent: 'center', pointerEvents: 'none' }}>
      
      <div className="mode-switcher" style={{ pointerEvents: 'auto' }}>
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

      <div style={{ position: 'absolute', right: '24px', pointerEvents: 'auto', display: 'flex', gap: '10px' }}>
        <button 
          className="tool-btn" 
          style={{ padding: '8px', borderRadius: '50%', background: 'var(--panel-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--panel-border)' }}
          onClick={() => setIsSettingsOpen(true)}
          title="API Settings"
        >
          <Settings size={20} />
        </button>
        <button 
          className="tool-btn" 
          style={{ padding: '8px', borderRadius: '50%', background: 'var(--panel-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--panel-border)' }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

    </div>
      {isSettingsOpen && <ApiSettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </>
  );
};
