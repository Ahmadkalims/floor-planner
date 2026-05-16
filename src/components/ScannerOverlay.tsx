import React from 'react';
import { useStore } from '../store/useStore';
import { ScanLine } from 'lucide-react';

export const ScannerOverlay: React.FC = () => {
  const isScanning = useStore(state => state.isScanning);

  if (!isScanning) return null;

  return (
    <div className="scanner-overlay">
      <ScanLine size={64} color="var(--accent-color)" />
      <div className="scanner-line"></div>
      <div style={{ color: 'white', fontSize: '18px', fontWeight: 500, marginTop: '20px' }}>
        AI is analyzing the floorplan image...
      </div>
    </div>
  );
};
