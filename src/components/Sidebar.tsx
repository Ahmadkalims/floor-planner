import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { ItemType } from '../store/useStore';
import { 
  MousePointer2, Square, DoorClosed, Sofa, Trash2,
  ScanLine, BedDouble, Bath, Wind, Combine, Lightbulb,
  Download, Upload, ChevronLeft, ChevronRight
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    mode, setMode, 
    activeToolItemType, setActiveToolItemType,
    clearAll, mockAI_Populate, mockAI_Scan,
    phase
  } = useStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'build' | 'furniture' | 'lighting' | 'plumbing'>('build');

  if (phase === '3d') return null;

  const handleSetTool = (type: ItemType) => {
    // If the model exists in registry, the planner will auto-assign it later or we can do it here.
    // Actually, Planner2D handles creating the item, so we just set the active type.
    setActiveToolItemType(type);
  };

  const handleExport = () => {
    const { walls, items } = useStore.getState();
    const data = JSON.stringify({ walls, items });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'floorplan.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        useStore.getState().importState(data);
      } catch (err) {
        console.error("Failed to parse plan file");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Sidebar Toggle Button */}
      <button 
        style={{ 
          position: 'absolute', top: '80px', left: isSidebarOpen ? '320px' : '20px', 
          zIndex: 51, padding: '8px', borderRadius: '8px', cursor: 'pointer', 
          transition: 'left 0.3s ease', background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)', color: 'var(--text-main)',
          backdropFilter: 'blur(24px) saturate(180%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
        }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title="Toggle Sidebar"
      >
        {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <div className="sidebar glass-panel" style={{ 
        display: 'flex', flexDirection: 'column',
        left: isSidebarOpen ? '20px' : '-350px',
        transition: 'left 0.3s ease',
        paddingBottom: '20px'
      }}>
      <div>
        <div className="section-title">Draw Tools</div>
        <div className="tool-grid">
          <button 
            className={`tool-btn ${mode === 'select' ? 'active' : ''}`}
            onClick={() => setMode('select')}
          >
            <MousePointer2 size={24} />
            <span style={{ fontSize: '12px' }}>Select</span>
          </button>
          <button 
            className={`tool-btn ${mode === 'wall' ? 'active' : ''}`}
            onClick={() => setMode('wall')}
            title="Outer Wall"
          >
            <Square size={24} />
            <span style={{ fontSize: '12px' }}>Wall</span>
          </button>
          <button 
            className={`tool-btn ${mode === 'inner-wall' ? 'active' : ''}`}
            onClick={() => setMode('inner-wall')}
            title="Inner Wall"
          >
            <Square size={24} strokeWidth={1} />
            <span style={{ fontSize: '12px' }}>Inner</span>
          </button>
        </div>
      </div>

      <div>
        <div className="section-title">Custom Shapes</div>
        <div className="tool-grid">
          <button 
            className={`tool-btn ${mode === 'shape-builder' ? 'active' : ''}`}
            onClick={() => setMode('shape-builder')}
            title="Shape Builder"
          >
            <Combine size={24} />
            <span style={{ fontSize: '12px' }}>Builder</span>
          </button>
          <button 
            className={`tool-btn ${activeToolItemType === 'polygon' ? 'active' : ''}`}
            onClick={() => handleSetTool('polygon')}
            title="Draw Polygon Box"
          >
            <Square size={24} />
            <span style={{ fontSize: '12px' }}>Rect</span>
          </button>
        </div>
      </div>

      <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
        <div className="section-title">Asset Library</div>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
          {(['build', 'furniture', 'plumbing', 'lighting'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ 
                flex: 1, padding: '5px', fontSize: '11px', textTransform: 'capitalize',
                background: activeTab === tab ? 'var(--accent-color)' : 'rgba(0,0,0,0.2)',
                border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="tool-grid">
          {activeTab === 'build' && (
            <>
              <button className={`tool-btn ${activeToolItemType === 'door' ? 'active' : ''}`} onClick={() => handleSetTool('door')}>
                <DoorClosed size={24} /><span style={{ fontSize: '12px' }}>Door</span>
              </button>
              <button className={`tool-btn ${activeToolItemType === 'window' ? 'active' : ''}`} onClick={() => handleSetTool('window')}>
                <Square size={24} /><span style={{ fontSize: '12px' }}>Window</span>
              </button>
            </>
          )}

          {activeTab === 'furniture' && (
            <>
              <button className={`tool-btn ${activeToolItemType === 'bed' ? 'active' : ''}`} onClick={() => handleSetTool('bed')}>
                <BedDouble size={24} /><span style={{ fontSize: '12px' }}>Bed</span>
              </button>
              <button className={`tool-btn ${activeToolItemType === 'sofa' ? 'active' : ''}`} onClick={() => handleSetTool('sofa')}>
                <Sofa size={24} /><span style={{ fontSize: '12px' }}>Sofa</span>
              </button>
            </>
          )}

          {activeTab === 'plumbing' && (
            <>
              <button className={`tool-btn ${activeToolItemType === 'bathtub' ? 'active' : ''}`} onClick={() => handleSetTool('bathtub')}>
                <Bath size={24} /><span style={{ fontSize: '12px' }}>Bathtub</span>
              </button>
              <button className={`tool-btn ${activeToolItemType === 'toilet' ? 'active' : ''}`} onClick={() => handleSetTool('toilet')}>
                <Wind size={24} /><span style={{ fontSize: '12px' }}>Toilet</span>
              </button>
              <button className={`tool-btn ${activeToolItemType === 'washbasin' ? 'active' : ''}`} onClick={() => handleSetTool('washbasin')}>
                <Wind size={24} /><span style={{ fontSize: '12px' }}>Basin</span>
              </button>
            </>
          )}

          {activeTab === 'lighting' && (
            <>
              <button className={`tool-btn ${activeToolItemType === 'lamp' ? 'active' : ''}`} onClick={() => handleSetTool('lamp')}>
                <Lightbulb size={24} /><span style={{ fontSize: '12px' }}>Lamp</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="action-btn secondary" onClick={handleExport} style={{ flex: 1, padding: '8px' }}>
            <Download size={16} />
            Export
          </button>
          <label className="action-btn secondary" style={{ flex: 1, padding: '8px', textAlign: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: 0 }}>
            <Upload size={16} />
            Import
            <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          </label>
        </div>
        <button className="action-btn secondary" onClick={mockAI_Scan}>
          <ScanLine size={18} />
          Scan Map (AI Mock)
        </button>
        <button className="action-btn" onClick={mockAI_Populate}>
          AI Populate Room
        </button>
        <button className="action-btn secondary" onClick={clearAll} style={{ color: 'var(--danger-color)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <Trash2 size={18} />
          Clear Floorplan
        </button>
      </div>
    </div>
    </>
  );
};
