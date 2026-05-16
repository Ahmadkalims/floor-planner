import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { ModelRegistry } from '../config/models';

export type Point = { x: number; y: number };

export type Wall = {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
};

// Added polygon for custom shapes
export type ItemType = 'door' | 'window' | 'bed' | 'sofa' | 'bathtub' | 'toilet' | 'washbasin' | 'polygon' | 'lamp';

export type Item = {
  id: string;
  type: ItemType;
  position: Point;
  rotation: number; // in degrees
  width: number;
  length: number;
  height: number;
  wallId?: string; // If snapped to a wall
  wallOffset?: number; // 0 to 1 along the wall
  points?: Point[]; // For polygon type
  textureUrl?: string; // e.g. '/wood.png', '/marble.png'
  textureTiling?: number;
  textureRotation?: number;
  
  // 3D Model & Lighting Parameters
  modelUrl?: string;
  lightTemperature?: number; // Kelvin, e.g. 3000
  lightIntensity?: number;
  lightSoftness?: number; // Maps to distance/decay
};

export type AppMode = 'select' | 'wall' | 'inner-wall' | 'item' | 'shape-builder';
export type ViewPhase = '2d' | '3d';
export type Theme = 'dark' | 'light';
export type GizmoMode = 'translate' | 'rotate' | 'scale';

interface AppState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  
  phase: ViewPhase;
  setPhase: (phase: ViewPhase) => void;
  
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  gizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;

  floorTiling: number;
  setFloorTiling: (tiling: number) => void;
  
  isCrossSectionEnabled: boolean;
  setIsCrossSectionEnabled: (val: boolean) => void;
  crossSectionHeight: number;
  setCrossSectionHeight: (val: number) => void;
  
  walls: Wall[];
  addWall: (wall: Omit<Wall, 'id'>) => void;
  updateWall: (id: string, updates: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  
  items: Item[];
  addItem: (item: Omit<Item, 'id'>) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  removeItem: (id: string) => void;
  
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleSelection: (id: string) => void;

  activeToolItemType: ItemType | null;
  setActiveToolItemType: (type: ItemType | null) => void;

  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  
  clearAll: () => void;
  mockAI_Populate: () => void;
  mockAI_Scan: () => void;

  past: { walls: Wall[], items: Item[] }[];
  pushToHistory: () => void;
  undo: () => void;

  importState: (data: { walls: Wall[], items: Item[] }) => void;
}

const defaultWalls: Wall[] = [
  { id: uuidv4(), start: { x: 100, y: 100 }, end: { x: 500, y: 100 }, thickness: 15, height: 250 },
  { id: uuidv4(), start: { x: 500, y: 100 }, end: { x: 500, y: 400 }, thickness: 15, height: 250 },
  { id: uuidv4(), start: { x: 500, y: 400 }, end: { x: 100, y: 400 }, thickness: 15, height: 250 },
  { id: uuidv4(), start: { x: 100, y: 400 }, end: { x: 100, y: 100 }, thickness: 15, height: 250 },
];

const defaultItems: Item[] = [
  { id: uuidv4(), type: 'door', position: { x: 300, y: 400 }, rotation: 0, width: 80, length: 20, height: 200, wallId: defaultWalls[2].id },
  { id: uuidv4(), type: 'window', position: { x: 500, y: 250 }, rotation: 90, width: 100, length: 15, height: 120, wallId: defaultWalls[1].id },
  { id: uuidv4(), type: 'bed', position: { x: 180, y: 180 }, rotation: 0, width: 140, length: 200, height: 50 },
];

export const useStore = create<AppState>((set, get) => ({
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  
  phase: '2d',
  setPhase: (phase) => set({ phase }),
  
  mode: 'select',
  setMode: (mode) => set({ mode, activeToolItemType: null }),

  gizmoMode: 'translate',
  setGizmoMode: (mode) => set({ gizmoMode: mode }),

  floorTiling: 1,
  setFloorTiling: (tiling) => set({ floorTiling: tiling }),
  
  isCrossSectionEnabled: false,
  setIsCrossSectionEnabled: (val) => set({ isCrossSectionEnabled: val }),
  crossSectionHeight: 150,
  setCrossSectionHeight: (val) => set({ crossSectionHeight: val }),
  
  past: [],
  pushToHistory: () => set((state) => ({ past: [...state.past, { walls: state.walls, items: state.items }] })),
  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      walls: previous.walls,
      items: previous.items,
      selectedIds: []
    };
  }),

  walls: defaultWalls,
  addWall: (wall) => { get().pushToHistory(); set((state) => ({ walls: [...state.walls, { ...wall, id: uuidv4() }] })); },
  updateWall: (id, updates) => { get().pushToHistory(); set((state) => ({
    walls: state.walls.map(w => w.id === id ? { ...w, ...updates } : w)
  })); },
  removeWall: (id) => { get().pushToHistory(); set((state) => ({ walls: state.walls.filter(w => w.id !== id) })); },
  
  items: defaultItems,
  addItem: (item) => { 
    get().pushToHistory(); 
    const defaultModel = ModelRegistry[item.type]?.[0];
    const newItem = { 
      ...item, 
      id: uuidv4(),
      modelUrl: item.modelUrl || defaultModel
    };
    set((state) => ({ items: [...state.items, newItem] })); 
  },
  updateItem: (id, updates) => { get().pushToHistory(); set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, ...updates } : i)
  })); },
  removeItem: (id) => { get().pushToHistory(); set((state) => ({ items: state.items.filter(i => i.id !== id) })); },
  
  selectedIds: [],
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  toggleSelection: (id) => set((state) => ({
    selectedIds: state.selectedIds.includes(id) 
      ? state.selectedIds.filter(i => i !== id)
      : [...state.selectedIds, id]
  })),

  activeToolItemType: null,
  setActiveToolItemType: (type) => set({ activeToolItemType: type, mode: 'item' }),

  isScanning: false,
  setIsScanning: (isScanning) => set({ isScanning }),

  clearAll: () => { get().pushToHistory(); set({ walls: [], items: [], selectedIds: [] }); },
  
  importState: (data) => {
    get().pushToHistory();
    set({
      walls: data.walls || [],
      items: data.items || [],
      selectedIds: []
    });
  },

  mockAI_Populate: () => {
    get().addItem({
      type: 'toilet',
      position: { x: 200, y: 350 },
      rotation: 0,
      width: 40,
      length: 60,
      height: 80,
      modelUrl: '/models/toilet/model_1.glb'
    });
    get().addItem({
      type: 'washbasin',
      position: { x: 400, y: 350 },
      rotation: 0,
      width: 60,
      length: 45,
      height: 85,
      modelUrl: '/models/washbasin/model_1.glb'
    });
  },
  
  mockAI_Scan: () => {
    set({ isScanning: true });
    setTimeout(() => {
      set({ 
        isScanning: false,
        walls: defaultWalls,
        items: [] 
      });
    }, 3000);
  }
}));
