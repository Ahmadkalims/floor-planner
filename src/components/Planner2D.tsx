import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Group, Text, Transformer } from 'react-konva';
import Konva from 'konva';
import { useStore } from '../store/useStore';
import type { Point, Item } from '../store/useStore';
import type { KonvaEventObject } from 'konva/lib/Node';
import polygonClipping from 'polygon-clipping';

const distance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const pointToSegmentDistance = (p: Point, v: Point, w: Point) => {
  const l2 = distance(v, w) ** 2;
  if (l2 === 0) return distance(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
};

const projectPointOntoSegment = (p: Point, v: Point, w: Point): { point: Point, t: number } => {
  const l2 = distance(v, w) ** 2;
  if (l2 === 0) return { point: v, t: 0 };
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return { point: { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }, t };
};

const rectToPoints = (x: number, y: number, w: number, h: number): Point[] => [
  { x: x - w/2, y: y - h/2 },
  { x: x + w/2, y: y - h/2 },
  { x: x + w/2, y: y + h/2 },
  { x: x - w/2, y: y + h/2 },
  { x: x - w/2, y: y - h/2 }
];

export const Planner2D: React.FC = () => {
  const { 
    walls, addWall, items, addItem, updateItem, removeItem,
    mode, activeToolItemType, selectedIds, setSelectedIds, toggleSelection,
    theme, phase
  } = useStore();

  const [newWallStart, setNewWallStart] = useState<Point | null>(null);
  const [mousePos, setMousePos] = useState<Point | null>(null);

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  
  const [selectStart, setSelectStart] = useState<Point | null>(null);
  const [builderLine, setBuilderLine] = useState<Point[]>([]);
  
  // Custom Shape drawing
  const [drawingRectStart, setDrawingRectStart] = useState<Point | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const itemRefs = useRef<Record<string, Konva.Group>>({});

  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (transformerRef.current && mode === 'select') {
      const nodes = selectedIds.map(id => itemRefs.current[id]).filter(Boolean);
      transformerRef.current.nodes(nodes);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedIds, mode]);

  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useStore.getState().undo();
      }
      // Delete or Backspace for removing selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useStore.getState();
        if (state.selectedIds.length > 0) {
          state.pushToHistory();
          state.selectedIds.forEach(id => {
            state.removeWall(id);
            state.removeItem(id);
          });
          state.setSelectedIds([]);
        }
      }
      // Escape for cancelling wall draw
      if (e.key === 'Escape') {
        setNewWallStart(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getSnappedPosition = (rawPos: Point) => {
    let snapPos = null;
    for (const wall of walls) {
      if (distance(rawPos, wall.start) < 20) { snapPos = wall.start; break; }
      if (distance(rawPos, wall.end) < 20) { snapPos = wall.end; break; }
    }
    if (!snapPos) {
      for (const item of items) {
        if (item.type === 'polygon' && item.points) {
          for (const pt of item.points) {
            const absPt = { x: pt.x + item.position.x, y: pt.y + item.position.y };
            if (distance(rawPos, absPt) < 20) {
              snapPos = absPt;
              break;
            }
          }
          if (snapPos) break;
        }
      }
    }
    return snapPos || rawPos;
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      isPanning.current = true;
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const pos = transform.point(stage.getPointerPosition()!);

    if (mode === 'wall' || mode === 'inner-wall') {
      const snapPos = getSnappedPosition(pos);
      if (!newWallStart) setNewWallStart(snapPos);
      else {
        const thickness = mode === 'inner-wall' ? 8 : 15;
        addWall({ start: newWallStart, end: snapPos, thickness, height: 250 });
        setNewWallStart(snapPos);
      }
    } else if (mode === 'item' && activeToolItemType) {
      if (activeToolItemType === 'polygon') {
        setDrawingRectStart(pos);
        return;
      }

      let newItemPos = pos;
      let rotation = 0;
      let wallId = undefined;
      let wallOffset = undefined;

      if (activeToolItemType === 'door' || activeToolItemType === 'window') {
        let closestWall = null;
        let minDistance = 50;
        for (const wall of walls) {
          const dist = pointToSegmentDistance(pos, wall.start, wall.end);
          if (dist < minDistance) { minDistance = dist; closestWall = wall; }
        }
        if (closestWall) {
          const projection = projectPointOntoSegment(pos, closestWall.start, closestWall.end);
          newItemPos = projection.point;
          wallId = closestWall.id;
          wallOffset = projection.t;
          const angle = Math.atan2(closestWall.end.y - closestWall.start.y, closestWall.end.x - closestWall.start.x);
          rotation = angle * (180 / Math.PI);
        } else return;
      }

      addItem({
        type: activeToolItemType,
        position: newItemPos,
        rotation,
        width: activeToolItemType === 'door' ? 80 : (activeToolItemType === 'window' ? 100 : 100),
        length: activeToolItemType === 'door' ? 20 : (activeToolItemType === 'window' ? 15 : 60),
        height: activeToolItemType === 'door' ? 200 : (activeToolItemType === 'window' ? 120 : 50),
        wallId,
        wallOffset
      });

    } else if (mode === 'select') {
      const clickedOnEmpty = e.target === stage;
      if (clickedOnEmpty) { setSelectedIds([]); setSelectStart(pos); }
    } else if (mode === 'shape-builder') {
      setBuilderLine([pos]);
    }
  };

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    setScale(newScale);

    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning.current) {
      setStagePos(old => ({ x: old.x + e.evt.movementX, y: old.y + e.evt.movementY }));
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const transform = stage.getAbsoluteTransform().copy().invert();
    let pos = transform.point(stage.getPointerPosition()!);

    if (e.evt.ctrlKey) {
      pos.x = Math.round(pos.x / 50) * 50;
      pos.y = Math.round(pos.y / 50) * 50;
    }

    if ((mode === 'wall' || mode === 'inner-wall') && newWallStart && e.evt.shiftKey) {
      const angle = Math.atan2(pos.y - newWallStart.y, pos.x - newWallStart.x);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const dist = distance(newWallStart, pos);
      pos = { x: newWallStart.x + Math.cos(snappedAngle) * dist, y: newWallStart.y + Math.sin(snappedAngle) * dist };
    }

    if (mode === 'item' && activeToolItemType === 'polygon' && drawingRectStart && e.evt.shiftKey) {
      const dx = pos.x - drawingRectStart.x;
      const dy = pos.y - drawingRectStart.y;
      const sizeSquare = Math.max(Math.abs(dx), Math.abs(dy));
      pos.x = drawingRectStart.x + (Math.sign(dx) || 1) * sizeSquare;
      pos.y = drawingRectStart.y + (Math.sign(dy) || 1) * sizeSquare;
    }

    if (mode === 'wall' || mode === 'inner-wall') {
      pos = getSnappedPosition(pos);
    }

    if (mode === 'shape-builder' && builderLine.length > 0) {
      setBuilderLine([...builderLine, pos]);
    }

    setMousePos(pos);
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 2) {
      isPanning.current = false;
      return;
    }

    if (mode === 'item' && activeToolItemType === 'polygon' && drawingRectStart && mousePos) {
      let minX = Math.min(drawingRectStart.x, mousePos.x);
      let maxX = Math.max(drawingRectStart.x, mousePos.x);
      let minY = Math.min(drawingRectStart.y, mousePos.y);
      let maxY = Math.max(drawingRectStart.y, mousePos.y);
      let w = maxX - minX;
      let h = maxY - minY;
      
      if (e.evt.shiftKey) {
        const size = Math.max(w, h);
        w = size; h = size;
        maxX = drawingRectStart.x <= mousePos.x ? drawingRectStart.x + size : drawingRectStart.x;
        minX = drawingRectStart.x <= mousePos.x ? drawingRectStart.x : drawingRectStart.x - size;
        maxY = drawingRectStart.y <= mousePos.y ? drawingRectStart.y + size : drawingRectStart.y;
        minY = drawingRectStart.y <= mousePos.y ? drawingRectStart.y : drawingRectStart.y - size;
      }
      
      if (w > 5 && h > 5) {
        addItem({
          type: 'polygon',
          position: { x: (minX + maxX)/2, y: (minY + maxY)/2 },
          rotation: 0,
          width: w,
          length: h,
          height: 100,
          points: rectToPoints(0, 0, w, h)
        });
      }
      setDrawingRectStart(null);
    }

    if (mode === 'select' && selectStart && mousePos) {
      const minX = Math.min(selectStart.x, mousePos.x);
      const maxX = Math.max(selectStart.x, mousePos.x);
      const minY = Math.min(selectStart.y, mousePos.y);
      const maxY = Math.max(selectStart.y, mousePos.y);

      const inBox = items.filter(i => 
        i.position.x >= minX && i.position.x <= maxX &&
        i.position.y >= minY && i.position.y <= maxY
      ).map(i => i.id);
      
      if (inBox.length > 0) setSelectedIds(inBox);
      setSelectStart(null);
    }

    if (mode === 'shape-builder' && builderLine.length > 0) {
      const isSubtract = e.evt.altKey;
      executeShapeBuilder(isSubtract);
      setBuilderLine([]);
    }
  };

  const executeShapeBuilder = (isSubtract: boolean) => {
    const polys = items.filter(i => i.type === 'polygon' && i.points);
    if (polys.length < 2) return;

    // or all polygons if none selected. Actually, a true illustrator style checks intersection with the line.
    // Let's just do an operation on ALL currently selected polygons.
    const selectedPolys = polys.filter(p => selectedIds.includes(p.id));
    if (selectedPolys.length < 2) return;

    try {
      // Convert to polygon-clipping format: [[[x,y],[x,y]...]]]
      // Note: Coordinates must be absolute to merge them correctly. Also must close the ring.
      const getAbsoluteCoords = (item: Item) => {
        const pts = item.points!.map(p => [p.x + item.position.x, p.y + item.position.y] as [number, number]);
        if (pts.length > 0 && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])) {
          pts.push([...pts[0]]);
        }
        return [pts];
      };

      const poly1 = getAbsoluteCoords(selectedPolys[0]);
      let result = poly1;

      for (let i = 1; i < selectedPolys.length; i++) {
        const poly2 = getAbsoluteCoords(selectedPolys[i]);
        if (isSubtract) {
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

        // Remove old ones
        selectedPolys.forEach(p => removeItem(p.id));

        // Add new one
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
    } catch (e) {
      console.error("Shape builder failed", e);
    }
  };

  const handleItemDragMove = (e: KonvaEventObject<DragEvent>, id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    let pos = { x: e.target.x(), y: e.target.y() };
    
    if (e.evt.ctrlKey) {
      pos.x = Math.round(pos.x / 50) * 50;
      pos.y = Math.round(pos.y / 50) * 50;
      e.target.position(pos);
    }

    if (item.type === 'door' || item.type === 'window') {
      let closestWall = null;
      let minDistance = 50;

      for (const wall of walls) {
        const dist = pointToSegmentDistance(pos, wall.start, wall.end);
        if (dist < minDistance) {
          minDistance = dist;
          closestWall = wall;
        }
      }

      if (closestWall) {
        const projection = projectPointOntoSegment(pos, closestWall.start, closestWall.end);
        const angle = Math.atan2(closestWall.end.y - closestWall.start.y, closestWall.end.x - closestWall.start.x);
        
        e.target.position(projection.point);
        e.target.rotation(angle * (180 / Math.PI));

        updateItem(id, { 
          position: projection.point, 
          rotation: angle * (180 / Math.PI),
          wallId: closestWall.id,
          wallOffset: projection.t
        });
      }
    } else {
      updateItem(id, { position: pos });
    }
  };

  const handleTransformEnd = () => {
    selectedIds.forEach(id => {
      const node = itemRefs.current[id];
      if (node) {
        const item = items.find(i => i.id === id);
        if (!item) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        const rotation = node.rotation();
        const pos = { x: node.x(), y: node.y() };

        node.scaleX(1);
        node.scaleY(1);

        if (item.type === 'polygon' && item.points) {
          const newPoints = item.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
          updateItem(id, { 
            position: pos, 
            rotation, 
            width: item.width * scaleX, 
            length: item.length * scaleY,
            points: newPoints
          });
        } else {
          updateItem(id, {
            position: pos,
            rotation,
            width: item.width * scaleX,
            length: item.length * scaleY
          });
        }
      }
    });
  };

  const strokeColor = theme === 'dark' ? '#ffffff' : '#000000';

  if (phase === '3d') return null;

  return (
    <div className="canvas-container" ref={containerRef} onContextMenu={(e) => e.preventDefault()}>
      <Stage 
        width={size.width} 
        height={size.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <Layer>
          <Group opacity={0.1}>
            {Array.from({ length: 100 }).map((_, i) => (
              <React.Fragment key={i}>
                <Line points={[-2000, (i-50) * 50, 4000, (i-50) * 50]} stroke={strokeColor} strokeWidth={1} />
                <Line points={[(i-50) * 50, -2000, (i-50) * 50, 4000]} stroke={strokeColor} strokeWidth={1} />
              </React.Fragment>
            ))}
          </Group>

          {walls.map(wall => (
            <Line
              key={wall.id}
              points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
              stroke={selectedIds.includes(wall.id) ? 'var(--accent-color)' : strokeColor}
              strokeWidth={wall.thickness}
              lineCap="round"
              lineJoin="round"
              onClick={(e) => {
                if (mode === 'select') {
                  if (e.evt.shiftKey) toggleSelection(wall.id);
                  else setSelectedIds([wall.id]);
                }
              }}
            />
          ))}

          {newWallStart && mousePos && (mode === 'wall' || mode === 'inner-wall') && (
            <Line points={[newWallStart.x, newWallStart.y, mousePos.x, mousePos.y]} stroke={strokeColor} strokeWidth={mode === 'inner-wall' ? 8 : 15} opacity={0.5} lineCap="round" />
          )}

          {items.map(item => {
            const isSelected = selectedIds.includes(item.id);
            const color = item.type === 'door' ? '#f59e0b' : 
                          item.type === 'window' ? '#3b82f6' : 
                          item.type === 'polygon' ? '#ec4899' :
                          item.type === 'bed' ? '#10b981' : 
                          item.type === 'toilet' || item.type === 'bathtub' || item.type === 'washbasin' ? '#06b6d4' : '#8b5cf6';
            
            return (
              <Group
                key={item.id}
                ref={(node) => {
                  if (node) itemRefs.current[item.id] = node;
                }}
                x={item.position.x}
                y={item.position.y}
                rotation={item.rotation}
                draggable={mode === 'select'}
                onDragMove={(e) => handleItemDragMove(e, item.id)}
                onClick={(e) => {
                  if (mode === 'select') {
                    if (e.evt.shiftKey) toggleSelection(item.id);
                    else setSelectedIds([item.id]);
                  }
                }}
              >
                {item.type === 'polygon' && item.points ? (
                  <Line
                    points={item.points.flatMap(p => [p.x, p.y])}
                    fill={color}
                    opacity={isSelected ? 0.9 : 0.7}
                    stroke={isSelected ? 'white' : 'transparent'}
                    strokeWidth={2}
                    closed={true}
                  />
                ) : (
                  <Rect
                    x={-item.width / 2}
                    y={-item.length / 2}
                    width={item.width}
                    height={item.length}
                    fill={color}
                    opacity={isSelected ? 1 : 0.8}
                    stroke={isSelected ? 'white' : 'transparent'}
                    strokeWidth={2}
                    cornerRadius={item.type === 'bed' ? 4 : 2}
                  />
                )}
                
                {item.type !== 'polygon' && (
                  <Text text={item.type.substring(0,1).toUpperCase()} x={-6} y={-6} fill="white" fontSize={12} fontFamily="Inter" />
                )}
              </Group>
            );
          })}

          {/* Select Box */}
          {selectStart && mousePos && mode === 'select' && (
            <Rect
              x={Math.min(selectStart.x, mousePos.x)}
              y={Math.min(selectStart.y, mousePos.y)}
              width={Math.abs(mousePos.x - selectStart.x)}
              height={Math.abs(mousePos.y - selectStart.y)}
              fill="rgba(79, 70, 229, 0.2)"
              stroke="var(--accent-color)"
              strokeWidth={1}
            />
          )}

          {/* Drawing Polygon Box Preview */}
          {drawingRectStart && mousePos && mode === 'item' && activeToolItemType === 'polygon' && (() => {
            let minX = Math.min(drawingRectStart.x, mousePos.x);
            let maxX = Math.max(drawingRectStart.x, mousePos.x);
            let minY = Math.min(drawingRectStart.y, mousePos.y);
            let maxY = Math.max(drawingRectStart.y, mousePos.y);
            let w = maxX - minX;
            let h = maxY - minY;
            
            // Replicate shift constraint visually
            // Unfortunately we don't have e.evt here, but we can do a rough approximation if width/height are similar
            // A better way is to just use mousePos which is already constrained? Wait, mousePos is NOT constrained, only the calculation in handleMouseUp is.
            // Let's rely on standard drag for preview, it will snap to square on release.
            return (
              <Rect
                x={minX}
                y={minY}
                width={w}
                height={h}
                fill="rgba(236, 72, 153, 0.5)"
                stroke="#ec4899"
                strokeWidth={2}
              />
            );
          })()}

          {/* Shape Builder Line */}
          {builderLine.length > 0 && mode === 'shape-builder' && (
            <Line
              points={builderLine.flatMap(p => [p.x, p.y])}
              stroke="var(--danger-color)"
              strokeWidth={2}
              dash={[5, 5]}
            />
          )}

          {/* Konva Transformer for Handles */}
          {mode === 'select' && (
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(_oldBox, newBox) => {
                if (window.event && (window.event as MouseEvent).ctrlKey) {
                  newBox.width = Math.round(newBox.width / 50) * 50;
                  newBox.height = Math.round(newBox.height / 50) * 50;
                  // Prevents shrinking below 50
                  if (newBox.width < 50) newBox.width = 50;
                  if (newBox.height < 50) newBox.height = 50;
                }
                return newBox;
              }}
              onTransformEnd={handleTransformEnd}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};
