import React, { useMemo, Suspense, useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, MeshReflectorMaterial, useTexture, useGLTF, TransformControls, Text } from '@react-three/drei';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Wall, Item, Point } from '../store/useStore';
import * as THREE from 'three';
import { ModelRegistry } from '../config/models';
import { AIRenderModal } from './AIRenderModal';

const distance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

// React Error Boundary to catch 404s when custom .glb files are missing
class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: React.ReactNode, children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.warn("Model failed to load, falling back to primitive shape.", error); }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const kelvinToRGB = (temp: number) => {
  // Simple approximation
  temp = temp / 100;
  let r, g, b;
  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) b = 0;
    else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }
  return new THREE.Color(
    Math.min(255, Math.max(0, r)) / 255,
    Math.min(255, Math.max(0, g)) / 255,
    Math.min(255, Math.max(0, b)) / 255
  );
};

const ModelLoader: React.FC<{ url: string; item: Item }> = ({ url, item }) => {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Enable shadows on all meshes in the loaded model
  useMemo(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [clonedScene]);

  const bbox = useMemo(() => new THREE.Box3().setFromObject(clonedScene), [clonedScene]);
  const size = useMemo(() => bbox.getSize(new THREE.Vector3()), [bbox]);
  const center = useMemo(() => bbox.getCenter(new THREE.Vector3()), [bbox]);

  // Fit into bounds
  const scaleX = size.x === 0 ? 1 : item.width / size.x;
  const scaleY = size.y === 0 ? 1 : item.height / size.y;
  const scaleZ = size.z === 0 ? 1 : item.length / size.z;

  return (
    <primitive 
      object={clonedScene} 
      scale={[scaleX, scaleY, scaleZ]} 
      position={[-center.x * scaleX, -center.y * scaleY, -center.z * scaleZ]} 
    />
  );
};

const Wall3D: React.FC<{ wall: Wall }> = ({ wall }) => {
  const { theme, isCrossSectionEnabled, crossSectionHeight, showDimensions } = useStore();
  const length = distance(wall.start, wall.end);
  const cx = (wall.start.x + wall.end.x) / 2;
  const cy = (wall.start.y + wall.end.y) / 2;
  const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

  const renderedHeight = isCrossSectionEnabled ? Math.min(wall.height, crossSectionHeight) : wall.height;
  const yPos = renderedHeight / 2;

  return (
    <group>
      <mesh 
        position={[cx, yPos, cy]} 
        rotation={[0, -angle, 0]}
        castShadow 
        receiveShadow
      >
        <boxGeometry args={[length, renderedHeight, wall.thickness]} />
        <meshStandardMaterial color={theme === 'dark' ? '#1f2937' : '#f3f4f6'} roughness={0.3} metalness={0.2} />
      </mesh>
      
      {/* Corner Joints to make connections perfect */}
      <mesh position={[wall.start.x, yPos, wall.start.y]} castShadow receiveShadow>
        <cylinderGeometry args={[wall.thickness / 2, wall.thickness / 2, renderedHeight, 16]} />
        <meshStandardMaterial color={theme === 'dark' ? '#1f2937' : '#f3f4f6'} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[wall.end.x, yPos, wall.end.y]} castShadow receiveShadow>
        <cylinderGeometry args={[wall.thickness / 2, wall.thickness / 2, renderedHeight, 16]} />
        <meshStandardMaterial color={theme === 'dark' ? '#1f2937' : '#f3f4f6'} roughness={0.3} metalness={0.2} />
      </mesh>

      {showDimensions && (
        <Text
          position={[cx, renderedHeight + 15, cy]}
          rotation={[0, -angle, 0]}
          fontSize={20}
          color={theme === 'dark' ? '#ffffff' : '#000000'}
          anchorX="center"
          anchorY="bottom"
        >
          {`${(length / 100).toFixed(2)}m`}
        </Text>
      )}
    </group>
  );
};

const Item3D: React.FC<{ item: Item }> = ({ item }) => {
  const { selectedIds, updateItem, gizmoMode } = useStore();
  const isSelected = selectedIds.includes(item.id);
  const groupRef = useRef<THREE.Group>(null!);
  const transformRef = useRef<any>(null);

  useEffect(() => {
    if (transformRef.current && isSelected) {
      const controls = transformRef.current;
      const callback = (e: any) => {
        if (!e.value && groupRef.current) { // e.value is true on drag start, false on drag end
          const p = groupRef.current.position;
          const r = groupRef.current.rotation;
          const s = groupRef.current.scale;

          updateItem(item.id, {
            position: { x: p.x, y: p.z },
            rotation: -r.y * 180 / Math.PI,
            width: item.width * s.x,
            height: item.height * s.y,
            length: item.length * s.z
          });
          
          groupRef.current.scale.set(1, 1, 1);
        }
      };
      controls.addEventListener('dragging-changed', callback);
      return () => controls.removeEventListener('dragging-changed', callback);
    }
  }, [item, isSelected, updateItem]);

  if (item.type === 'polygon') return <PolygonFloor3D item={item} />;

  const rotRad = -(item.rotation * Math.PI) / 180;

  let color = '#ffffff';
  if (item.type === 'bed') color = '#10b981';
  else if (item.type === 'sofa') color = '#8b5cf6';
  else if (item.type === 'door') color = '#f59e0b';
  else if (item.type === 'window') color = '#3b82f6';
  else if (item.type === 'lamp') color = '#fcd34d';
  else color = '#06b6d4'; // bathroom stuff

  const isHoleFiller = item.type === 'window' || item.type === 'door';
  const fillY = item.type === 'door' ? item.height / 2 : item.height / 2 + 50;
  const yPos = isHoleFiller ? fillY : item.height / 2;

  const fallbackMesh = (
    <mesh castShadow={!isHoleFiller} receiveShadow>
      {item.type === 'window' || item.type === 'door' ? (
         <boxGeometry args={[item.width, item.height, item.length + 2]} />
      ) : (
         <cylinderGeometry args={[item.width/2, item.width/2, item.height, 8]} />
      )}
      <meshStandardMaterial 
        color={color} 
        roughness={isHoleFiller ? 0.1 : 0.3} 
        metalness={isHoleFiller ? 0.8 : 0.2} 
        transparent={isHoleFiller}
        opacity={isHoleFiller ? 0.7 : 1}
      />
    </mesh>
  );

  const content = (
    <group 
      ref={groupRef}
      position={[item.position.x, yPos, item.position.y]} 
      rotation={[0, rotRad, 0]}
      onClick={(e) => {
        e.stopPropagation();
        useStore.getState().setSelectedIds([item.id]);
      }}
    >
      {item.modelUrl ? (
        <ErrorBoundary fallback={fallbackMesh}>
          <Suspense fallback={fallbackMesh}>
            <ModelLoader url={item.modelUrl} item={item} />
          </Suspense>
        </ErrorBoundary>
      ) : fallbackMesh}

      {/* Lighting for Lamps */}
      {item.type === 'lamp' && (
        <pointLight 
          color={kelvinToRGB(item.lightTemperature || 4000)}
          intensity={item.lightIntensity ?? 1} 
          distance={item.lightSoftness ?? 300} 
          decay={2} 
          castShadow 
          position={[0, item.height / 2 + 10, 0]} 
        />
      )}
    </group>
  );

  return (
    <>
      {isSelected && !isHoleFiller && (
        <TransformControls ref={transformRef} object={groupRef} mode={gizmoMode} />
      )}
      {content}
    </>
  );
};

const PolygonFloor3D: React.FC<{ item: Item }> = ({ item }) => {
  const { toggleSelection, selectedIds } = useStore();
  const isSelected = selectedIds.includes(item.id);
  
  const textureUrl = item.textureUrl || '/textures/wood.png';
  const tiling = item.textureTiling || 10;
  const texRot = item.textureRotation || 0;

  const texture = useTexture(textureUrl);
  
  const clonedTex = useMemo(() => {
    const t = texture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(tiling / 10, tiling / 10);
    t.rotation = (texRot * Math.PI) / 180;
    t.needsUpdate = true;
    return t;
  }, [texture, tiling, texRot]);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    item.points!.forEach((p, i) => {
      if (i === 0) s.moveTo(p.x, p.y);
      else s.lineTo(p.x, p.y);
    });
    return s;
  }, [item]);

  return (
    <mesh 
      position={[item.position.x, 1.0, item.position.y]} 
      rotation={[Math.PI / 2, 0, 0]} 
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        toggleSelection(item.id);
      }}
    >
      <extrudeGeometry args={[shape, { depth: 0.5, bevelEnabled: false }]} />
      <meshStandardMaterial 
        map={clonedTex} 
        roughness={0.6} 
        metalness={0.1} 
        emissive={isSelected ? new THREE.Color(0.1, 0.1, 0.1) : new THREE.Color(0,0,0)}
      />
    </mesh>
  );
};

const SceneContent: React.FC = () => {
  const { walls, items, theme } = useStore();

  return (
    <>
      <group>
        {walls.map(wall => (
          <Wall3D key={wall.id} wall={wall} />
        ))}
        {items.map(item => (
          <Item3D key={item.id} item={item} />
        ))}
      </group>

      {/* Global Background Floor (Reflective, Soft Bluish) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[10000, 10000]} />
        <MeshReflectorMaterial
          blur={[1000, 300]}
          resolution={1024}
          mixBlur={3}
          mixStrength={10}
          roughness={theme === 'dark' ? 1 : 0.6}
          depthScale={1.2}
          minDepthThreshold={0.1}
          maxDepthThreshold={1.2}
          color={theme === 'dark' ? "#0d1424" : "#ffffff"}
          metalness={theme === 'dark' ? 0.2 : 0.1}
          mirror={theme === 'dark' ? 0.1 : 0.4}
        />
      </mesh>
    </>
  );
};

const MiniMap: React.FC = () => {
  const { walls, items, theme } = useStore();
  
  const { minX, minY, width, height } = useMemo(() => {
    if (walls.length === 0 && items.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 };
    let mx = Infinity, my = Infinity, max = -Infinity, may = -Infinity;
    
    walls.forEach(w => {
      if (w.start.x < mx) mx = w.start.x;
      if (w.end.x < mx) mx = w.end.x;
      if (w.start.x > max) max = w.start.x;
      if (w.end.x > max) max = w.end.x;
      
      if (w.start.y < my) my = w.start.y;
      if (w.end.y < my) my = w.end.y;
      if (w.start.y > may) may = w.start.y;
      if (w.end.y > may) may = w.end.y;
    });

    items.forEach(i => {
      if (i.position.x < mx) mx = i.position.x;
      if (i.position.x > max) max = i.position.x;
      if (i.position.y < my) my = i.position.y;
      if (i.position.y > may) may = i.position.y;
    });

    const pad = 100;
    return {
      minX: mx - pad,
      minY: my - pad,
      width: (max - mx) + pad * 2,
      height: (may - my) + pad * 2
    };
  }, [walls, items]);

  const strokeColor = theme === 'dark' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', color: strokeColor, width: '100%', textAlign: 'left' }}>Floor Plan</div>
      <svg width="100%" height="150" viewBox={`${minX} ${minY} ${width} ${height}`} style={{ border: `1px solid ${strokeColor}40`, borderRadius: '4px', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }}>
        {walls.map(w => (
          <line 
            key={w.id} 
            x1={w.start.x} y1={w.start.y} 
            x2={w.end.x} y2={w.end.y} 
            stroke={strokeColor} 
            strokeWidth={w.thickness} 
            strokeLinecap="round" 
          />
        ))}
      </svg>
    </div>
  );
};

const CrossSectionPanel: React.FC = () => {
  const { isCrossSectionEnabled, setIsCrossSectionEnabled, crossSectionHeight, setCrossSectionHeight } = useStore();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
        <input type="checkbox" checked={isCrossSectionEnabled} onChange={e => setIsCrossSectionEnabled(e.target.checked)} />
        Enable Cross-Section Viewer
      </label>
      {isCrossSectionEnabled && (
        <div className="param-input" style={{ marginTop: '10px' }}>
          <label>Height Cutoff: {crossSectionHeight}</label>
          <input type="range" min={0} max={400} value={crossSectionHeight} onChange={e => setCrossSectionHeight(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
};

const ItemPropertiesPanel3D: React.FC = () => {
  const { selectedIds, items, updateItem, gizmoMode, setGizmoMode } = useStore();
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const selectedItem = items.find(i => i.id === selectedIds[0]);

  if (selectedIds.length !== 1 || !selectedItem) return null;

  const isPolygon = selectedItem.type === 'polygon';
  const isLamp = selectedItem.type === 'lamp';
  const variants = ModelRegistry[selectedItem.type] || [];

  return (
    <>
      <button 
        style={{ 
          position: 'absolute', top: '80px', left: isLeftPanelOpen ? '280px' : '20px', 
          zIndex: 11, padding: '8px', borderRadius: '8px', cursor: 'pointer', 
          transition: 'left 0.3s ease', background: 'var(--panel-bg)',
          border: '1px solid var(--panel-border)', color: 'var(--text-main)',
          backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        title="Toggle Properties"
      >
        {isLeftPanelOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      <div className="glass-panel" style={{ 
        position: 'absolute', top: '80px', left: isLeftPanelOpen ? '20px' : '-300px', 
        zIndex: 10, width: '250px', display: 'flex', flexDirection: 'column', gap: '15px',
        transition: 'left 0.3s ease'
      }}>
      <div className="section-title" style={{ textTransform: 'capitalize' }}>{selectedItem.type} Properties</div>
      
      {!isPolygon && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
          <button className={`tool-btn ${gizmoMode === 'translate' ? 'active' : ''}`} onClick={() => setGizmoMode('translate')} style={{ flex: 1, padding: '5px' }}>Move</button>
          <button className={`tool-btn ${gizmoMode === 'rotate' ? 'active' : ''}`} onClick={() => setGizmoMode('rotate')} style={{ flex: 1, padding: '5px' }}>Rotate</button>
          <button className={`tool-btn ${gizmoMode === 'scale' ? 'active' : ''}`} onClick={() => setGizmoMode('scale')} style={{ flex: 1, padding: '5px' }}>Scale</button>
        </div>
      )}

      {/* Position & Rotation */}
      <div style={{ display: 'flex', gap: '5px' }}>
        <div className="param-input">
          <label>X (cm)</label>
          <input type="number" value={Math.round(selectedItem.position.x)} onChange={e => updateItem(selectedItem.id, { position: { ...selectedItem.position, x: Number(e.target.value) }})} style={{ width: '100%' }} />
        </div>
        <div className="param-input">
          <label>Y (cm)</label>
          <input type="number" value={Math.round(selectedItem.position.y)} onChange={e => updateItem(selectedItem.id, { position: { ...selectedItem.position, y: Number(e.target.value) }})} style={{ width: '100%' }} />
        </div>
        <div className="param-input">
          <label>Rot (°)</label>
          <input type="number" value={Math.round(selectedItem.rotation)} onChange={e => updateItem(selectedItem.id, { rotation: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </div>

      {/* Dimension Overrides */}
      <div style={{ display: 'flex', gap: '5px' }}>
        <div className="param-input">
          <label>W (m)</label>
          <input type="number" step="0.1" value={Number((selectedItem.width / 100).toFixed(2))} onChange={e => updateItem(selectedItem.id, { width: Number(e.target.value) * 100 })} style={{ width: '100%' }} />
        </div>
        <div className="param-input">
          <label>L (m)</label>
          <input type="number" step="0.1" value={Number((selectedItem.length / 100).toFixed(2))} onChange={e => updateItem(selectedItem.id, { length: Number(e.target.value) * 100 })} style={{ width: '100%' }} />
        </div>
        <div className="param-input">
          <label>H (m)</label>
          <input type="number" step="0.1" value={Number((selectedItem.height / 100).toFixed(2))} onChange={e => updateItem(selectedItem.id, { height: Number(e.target.value) * 100 })} style={{ width: '100%' }} />
        </div>
      </div>

      {isPolygon && (
        <>
          <div className="param-input">
            <label>Texture Map</label>
            <select 
              value={selectedItem.textureUrl || '/textures/wood.png'} 
              onChange={e => updateItem(selectedItem.id, { textureUrl: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: 'inherit', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <option value="/textures/wood.png" style={{ color: 'black' }}>Dark Wood</option>
              <option value="/textures/light_wood.png" style={{ color: 'black' }}>Light Wood</option>
              <option value="/textures/marble.png" style={{ color: 'black' }}>White Marble</option>
              <option value="/textures/concrete.png" style={{ color: 'black' }}>Polished Concrete</option>
            </select>
          </div>
          <div className="param-input">
            <label>Tiling Scale: {selectedItem.textureTiling || 10}</label>
            <input type="range" min={1} max={50} value={selectedItem.textureTiling || 10} onChange={e => updateItem(selectedItem.id, { textureTiling: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
        </>
      )}

      {!isPolygon && variants.length > 0 && (
        <div className="param-input">
          <label>3D Model Variant</label>
          <select 
            value={selectedItem.modelUrl || variants[0]} 
            onChange={e => updateItem(selectedItem.id, { modelUrl: e.target.value })}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', color: 'inherit', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {variants.map((v: string, i: number) => (
              <option key={v} value={v} style={{ color: 'black' }}>Variant {i + 1}</option>
            ))}
          </select>
        </div>
      )}

      {isLamp && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="section-title">Light Emission</div>
          <div className="param-input">
            <label>Temperature ({selectedItem.lightTemperature || 4000}K)</label>
            <input type="range" min={2000} max={10000} value={selectedItem.lightTemperature || 4000} onChange={e => updateItem(selectedItem.id, { lightTemperature: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div className="param-input">
            <label>Strength ({selectedItem.lightIntensity ?? 1})</label>
            <input type="range" min={0} max={10} step={0.1} value={selectedItem.lightIntensity ?? 1} onChange={e => updateItem(selectedItem.id, { lightIntensity: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div className="param-input">
            <label>Softness/Distance ({selectedItem.lightSoftness ?? 300})</label>
            <input type="range" min={50} max={1000} value={selectedItem.lightSoftness ?? 300} onChange={e => updateItem(selectedItem.id, { lightSoftness: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export const Visualizer3D: React.FC = () => {
  const { walls, phase, theme, setSelectedIds, showDimensions, setShowDimensions } = useStore();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Global Escape key to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === '3d') {
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, setSelectedIds]);

  const center = useMemo(() => {
    if (walls.length === 0) return [300, 0, 300];
    let sumX = 0, sumY = 0;
    walls.forEach(w => { sumX += w.start.x; sumY += w.start.y; });
    return [sumX / walls.length, 0, sumY / walls.length];
  }, [walls]);

  if (phase === '2d') return null;

  return (
    <div className="canvas-container is-3d" style={{ position: 'relative', overflow: 'hidden' }}>
      <ItemPropertiesPanel3D />
      
      {/* Right Panel Toggle Button */}
      <button 
        style={{ 
          position: 'absolute', top: '80px', right: isRightPanelOpen ? '280px' : '20px', 
          zIndex: 11, padding: '8px', borderRadius: '8px', cursor: 'pointer', 
          transition: 'right 0.3s ease', background: theme === 'dark' ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(139, 92, 246, 0.3)', color: theme === 'dark' ? 'white' : 'black',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
        title="Toggle Tools"
      >
        {isRightPanelOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Collapsible Right Panel */}
      <div className="glass-panel" style={{ 
        position: 'absolute', top: '80px', right: isRightPanelOpen ? '20px' : '-300px', 
        zIndex: 10, width: '240px', display: 'flex', flexDirection: 'column', gap: '20px',
        transition: 'right 0.3s ease'
      }}>
        <MiniMap />
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        
        <div>
          <div className="section-title">View Settings</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)' }}>
            <input type="checkbox" checked={showDimensions} onChange={e => setShowDimensions(e.target.checked)} />
            Show Wall Dimensions
          </label>
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />

        <CrossSectionPanel />
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="section-title">AI Interior Generator</div>
          <button 
            className="action-btn" 
            style={{ background: 'linear-gradient(to right, #8b5cf6, #ec4899)', border: 'none', color: 'white', fontWeight: 'bold' }}
            onClick={() => setAiModalOpen(true)}
          >
            Generate Render
          </button>
        </div>
      </div>

      <AIRenderModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />

      <Canvas 
        gl={{ preserveDrawingBuffer: true }} 
        shadows 
        camera={{ position: [center[0], 800, center[2] + 800], fov: 45, far: 10000 }}
        onPointerMissed={() => setSelectedIds([])}
      >
        <React.Suspense fallback={null}>
          <color attach="background" args={[theme === 'dark' ? '#1e293b' : '#f8fafc']} />
          <fog attach="fog" args={[theme === 'dark' ? '#1e293b' : '#f8fafc', 1500, 4500]} />
          
          <ambientLight intensity={theme === 'dark' ? 0.9 : 1.2} color={theme === 'dark' ? "#e0e7ff" : "#ffffff"} />
          
          <directionalLight 
            position={[center[0] + 500, 1000, center[2] + 500]} 
            intensity={1.0} 
            color="#fff7ed"
            castShadow 
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
            shadow-camera-left={-2000}
            shadow-camera-right={2000}
            shadow-camera-top={2000}
            shadow-camera-bottom={-2000}
            shadow-camera-far={4000}
          />
          
          <pointLight position={[center[0] - 500, 500, center[2] - 500]} intensity={0.6} color="#bae6fd" />
          <pointLight position={[center[0], 300, center[2]]} intensity={1.5} color="#fef08a" distance={1000} decay={2} />

          <Environment preset="city" />

          <SceneContent />

          <OrbitControls 
            makeDefault
            target={[center[0], 0, center[2]]} 
            maxPolarAngle={Math.PI / 2 - 0.05} 
            minDistance={100}
            maxDistance={5000}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
};
