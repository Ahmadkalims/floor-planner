import React from 'react';
import { useStore } from '../store/useStore';
import { AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, Minus, ArrowDownToLine, PlusSquare, MinusSquare } from 'lucide-react';
import polygonClipping from 'polygon-clipping';
import type { Item } from '../store/useStore';

export const PropertiesPanel: React.FC = () => {
  const { selectedIds, setSelectedIds, items, walls, updateItem, removeItem, addItem, phase } = useStore();

  if (phase === '3d') return null;

  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedItems = items.filter(i => selectedIds.includes(i.id));
    if (selectedItems.length < 2) return;

    let targetVal = 0;
    if (type === 'left') targetVal = Math.min(...selectedItems.map(i => i.position.x - i.width/2));
    if (type === 'right') targetVal = Math.max(...selectedItems.map(i => i.position.x + i.width/2));
    if (type === 'center') {
      const minX = Math.min(...selectedItems.map(i => i.position.x - i.width/2));
      const maxX = Math.max(...selectedItems.map(i => i.position.x + i.width/2));
      targetVal = (minX + maxX) / 2;
    }

    if (type === 'top') targetVal = Math.min(...selectedItems.map(i => i.position.y - i.length/2));
    if (type === 'bottom') targetVal = Math.max(...selectedItems.map(i => i.position.y + i.length/2));
    if (type === 'middle') {
      const minY = Math.min(...selectedItems.map(i => i.position.y - i.length/2));
      const maxY = Math.max(...selectedItems.map(i => i.position.y + i.length/2));
      targetVal = (minY + maxY) / 2;
    }

    selectedItems.forEach(item => {
      let newX = item.position.x;
      let newY = item.position.y;
      
      if (type === 'left') newX = targetVal + item.width/2;
      if (type === 'right') newX = targetVal - item.width/2;
      if (type === 'center') newX = targetVal;
      
      if (type === 'top') newY = targetVal + item.length/2;
      if (type === 'bottom') newY = targetVal - item.length/2;
      if (type === 'middle') newY = targetVal;

      updateItem(item.id, { position: { x: newX, y: newY } });
    });
  };

  const handlePathfinder = (operation: 'union' | 'difference') => {
    const polys = items.filter(i => i.type === 'polygon' && i.points && selectedIds.includes(i.id));
    if (polys.length < 2) return;

    const getAbsoluteCoords = (item: Item) => {
      return [item.points!.map(p => [p.x + item.position.x, p.y + item.position.y] as [number, number])];
    };

    let result = getAbsoluteCoords(polys[0]);

    for (let i = 1; i < polys.length; i++) {
      const poly2 = getAbsoluteCoords(polys[i]);
      if (operation === 'difference') {
        result = polygonClipping.difference(result as any, poly2 as any) as any;
      } else {
        result = polygonClipping.union(result as any, poly2 as any) as any;
      }
    }

    if (result.length > 0 && result[0].length > 0) {
      const mergedRing = result[0][0] as unknown as [number, number][]; 
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      mergedRing.forEach((pt) => {
        const x = pt[0];
        const y = pt[1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      });
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const relativePoints = mergedRing.map(([x, y]) => ({ x: x - cx, y: y - cy }));

      polys.forEach(p => removeItem(p.id));

      addItem({
        type: 'polygon',
        position: { x: cx, y: cy },
        rotation: 0,
        width: maxX - minX,
        length: maxY - minY,
        height: 100,
        points: relativePoints
      });
      
      setSelectedIds([]);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  if (selectedIds.length > 1) {
    const polysSelected = items.filter(i => selectedIds.includes(i.id) && i.type === 'polygon').length;
    
    return (
      <div className="properties-panel glass-panel">
        <div className="section-title">Align</div>
        <div className="tool-grid">
          <button className="tool-btn" onClick={() => handleAlign('left')}><AlignLeft size={20}/></button>
          <button className="tool-btn" onClick={() => handleAlign('center')}><AlignCenter size={20}/></button>
          <button className="tool-btn" onClick={() => handleAlign('right')}><AlignRight size={20}/></button>
          <button className="tool-btn" onClick={() => handleAlign('top')}><ArrowUpToLine size={20}/></button>
          <button className="tool-btn" onClick={() => handleAlign('middle')}><Minus size={20}/></button>
          <button className="tool-btn" onClick={() => handleAlign('bottom')}><ArrowDownToLine size={20}/></button>
        </div>

        {polysSelected >= 2 && (
          <>
            <div className="section-title" style={{ marginTop: '20px' }}>Pathfinder</div>
            <div className="tool-grid">
              <button className="tool-btn" onClick={() => handlePathfinder('union')} title="Unite">
                <PlusSquare size={20}/>
              </button>
              <button className="tool-btn" onClick={() => handlePathfinder('difference')} title="Minus Front">
                <MinusSquare size={20}/>
              </button>
            </div>
          </>
        )}

        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>
          {selectedIds.length} items selected
        </div>
      </div>
    );
  }

  const selectedItem = items.find(i => i.id === selectedIds[0]);
  const selectedWall = walls.find(w => w.id === selectedIds[0]);

  if (!selectedItem && !selectedWall) return null;

  return (
    <div className="properties-panel glass-panel">
      <div className="section-title">Properties</div>
      
      {selectedItem && (
        <>
          <div className="item-preview">
            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedItem.type}</span>
          </div>

          <div className="param-input">
            <label>Width (m)</label>
            <input 
              type="number" 
              step="0.1"
              value={Number((selectedItem.width / 100).toFixed(2))} 
              onChange={e => {
                const newWidth = Number(e.target.value) * 100;
                if (selectedItem.type === 'polygon' && selectedItem.points && selectedItem.width > 0) {
                  const scaleX = newWidth / selectedItem.width;
                  const newPoints = selectedItem.points.map(p => ({ x: p.x * scaleX, y: p.y }));
                  updateItem(selectedItem.id, { width: newWidth, points: newPoints });
                } else {
                  updateItem(selectedItem.id, { width: newWidth });
                }
              }}
            />
          </div>
          <div className="param-input">
            <label>Length (m)</label>
            <input 
              type="number" 
              step="0.1"
              value={Number((selectedItem.length / 100).toFixed(2))} 
              onChange={e => {
                const newLength = Number(e.target.value) * 100;
                if (selectedItem.type === 'polygon' && selectedItem.points && selectedItem.length > 0) {
                  const scaleY = newLength / selectedItem.length;
                  const newPoints = selectedItem.points.map(p => ({ x: p.x, y: p.y * scaleY }));
                  updateItem(selectedItem.id, { length: newLength, points: newPoints });
                } else {
                  updateItem(selectedItem.id, { length: newLength });
                }
              }}
            />
          </div>
          <div className="param-input">
            <label>Rotation (°)</label>
            <input 
              type="number" 
              value={Math.round(selectedItem.rotation)} 
              onChange={e => updateItem(selectedItem.id, { rotation: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {selectedWall && (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          Wall Segment Selected
        </div>
      )}
    </div>
  );
};
