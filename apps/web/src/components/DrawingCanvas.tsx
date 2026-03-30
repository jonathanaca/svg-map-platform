import React, { useRef, useState, useCallback, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PathPoint {
  x: number;
  y: number;
}

export interface PathData {
  id: string;
  points: PathPoint[];
  closed: boolean;
}

export interface ShapeData {
  id: string;
  label: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

type Tool = 'select' | 'pen' | 'wall' | 'rect' | 'eraser';

interface Transform {
  scale: number;
  panX: number;
  panY: number;
}

interface HistoryState {
  outlinePaths: PathData[];
  wallPaths: PathData[];
  spaceHighlights: ShapeData[];
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  outlinePaths: PathData[];
  wallPaths: PathData[];
  spaceHighlights: ShapeData[];
  onOutlineChange: (paths: PathData[]) => void;
  onWallChange: (paths: PathData[]) => void;
  onSpaceHighlightsChange: (shapes: ShapeData[]) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function pointsToSvgPath(points: PathPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const parts = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`);
  if (closed) parts.push('Z');
  return parts.join(' ');
}

function distanceSq(a: PathPoint, b: PathPoint): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

const CLOSE_THRESHOLD = 100; // squared distance in image space
const MAX_HISTORY = 50;

// ── Component ────────────────────────────────────────────────────────────────

export default function DrawingCanvas({
  imageUrl,
  imageWidth,
  imageHeight,
  outlinePaths,
  wallPaths,
  spaceHighlights,
  onOutlineChange,
  onWallChange,
  onSpaceHighlightsChange,
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'outline' | 'wall' | 'highlight' | null>(null);

  // Drawing state
  const [currentPath, setCurrentPath] = useState<PathPoint[]>([]);
  const [currentPathType, setCurrentPathType] = useState<'outline' | 'wall' | null>(null);
  const [cursorPos, setCursorPos] = useState<PathPoint | null>(null);
  const [rectDraw, setRectDraw] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [labelInput, setLabelInput] = useState<{ shapeId: string; x: number; y: number; value: string } | null>(null);

  // Drag state for select tool
  const [dragState, setDragState] = useState<{ type: 'move' | 'control'; itemId: string; itemType: 'outline' | 'wall' | 'highlight'; pointIndex?: number; startMouse: PathPoint; startPoints?: PathPoint[]; startRect?: { x: number; y: number } } | null>(null);

  // Transform
  const [transform, setTransform] = useState<Transform>({ scale: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const spaceHeld = useRef(false);

  // Layer visibility
  const [showOutlines, setShowOutlines] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [showHighlights, setShowHighlights] = useState(true);

  // History
  const [history, setHistory] = useState<HistoryState[]>([]);
  const historyRef = useRef<HistoryState[]>([]);
  historyRef.current = history;

  const pushHistory = useCallback(() => {
    const snapshot: HistoryState = {
      outlinePaths: JSON.parse(JSON.stringify(outlinePaths)),
      wallPaths: JSON.parse(JSON.stringify(wallPaths)),
      spaceHighlights: JSON.parse(JSON.stringify(spaceHighlights)),
    };
    setHistory(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
  }, [outlinePaths, wallPaths, spaceHighlights]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.length === 0) return;
    const prev = h[h.length - 1];
    setHistory(h.slice(0, -1));
    onOutlineChange(prev.outlinePaths);
    onWallChange(prev.wallPaths);
    onSpaceHighlightsChange(prev.spaceHighlights);
  }, [onOutlineChange, onWallChange, onSpaceHighlightsChange]);

  // ── Coordinate conversion ──────────────────────────────────────────────

  const screenToImage = useCallback((clientX: number, clientY: number): PathPoint => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const sx = (clientX - rect.left - transform.panX) / transform.scale;
    const sy = (clientY - rect.top - transform.panY) / transform.scale;
    return { x: Math.round(sx), y: Math.round(sy) };
  }, [transform]);

  const imageToScreen = useCallback((ix: number, iy: number): { x: number; y: number } => {
    return {
      x: ix * transform.scale + transform.panX,
      y: iy * transform.scale + transform.panY,
    };
  }, [transform]);

  // ── Fit to view ────────────────────────────────────────────────────────

  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageWidth;
    const scaleY = rect.height / imageHeight;
    const scale = Math.min(scaleX, scaleY) * 0.95;
    const panX = (rect.width - imageWidth * scale) / 2;
    const panY = (rect.height - imageHeight * scale) / 2;
    setTransform({ scale, panX, panY });
  }, [imageWidth, imageHeight]);

  // Fit to view on mount
  useEffect(() => {
    fitToView();
  }, [fitToView]);

  // ── Zoom ───────────────────────────────────────────────────────────────

  const zoomAtPoint = useCallback((delta: number, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    setTransform(prev => {
      const factor = delta > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.05, Math.min(20, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return {
        scale: newScale,
        panX: mouseX - ratio * (mouseX - prev.panX),
        panY: mouseY - ratio * (mouseY - prev.panY),
      };
    });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.min(20, prev.scale * 1.2);
      const ratio = newScale / prev.scale;
      if (!containerRef.current) return { ...prev, scale: newScale };
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return { scale: newScale, panX: cx - ratio * (cx - prev.panX), panY: cy - ratio * (cy - prev.panY) };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => {
      const newScale = Math.max(0.05, prev.scale / 1.2);
      const ratio = newScale / prev.scale;
      if (!containerRef.current) return { ...prev, scale: newScale };
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return { scale: newScale, panX: cx - ratio * (cx - prev.panX), panY: cy - ratio * (cy - prev.panY) };
    });
  }, []);

  // ── Wheel handler ──────────────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Pinch zoom
        zoomAtPoint(e.deltaY, e.clientX, e.clientY);
      } else {
        // Scroll to zoom
        zoomAtPoint(e.deltaY, e.clientX, e.clientY);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomAtPoint]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in input
      if (labelInput) {
        if (e.key === 'Enter') {
          finishLabelInput();
        } else if (e.key === 'Escape') {
          cancelLabelInput();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('select'); cancelDrawing(); break;
        case 'p': setActiveTool('pen'); cancelDrawing(); break;
        case 'w': setActiveTool('wall'); cancelDrawing(); break;
        case 'r': setActiveTool('rect'); cancelDrawing(); break;
        case 'e': setActiveTool('eraser'); cancelDrawing(); break;
        case 'escape': cancelDrawing(); setSelectedId(null); setSelectedType(null); break;
        case 'delete':
        case 'backspace':
          if (selectedId && selectedType) {
            deleteSelected();
          }
          break;
        case 'z':
          if (e.metaKey || e.ctrlKey) { e.preventDefault(); undo(); }
          break;
        case '+':
        case '=':
          if (!e.metaKey && !e.ctrlKey) zoomIn();
          break;
        case '-':
          if (!e.metaKey && !e.ctrlKey) zoomOut();
          break;
        case ' ':
          e.preventDefault();
          spaceHeld.current = true;
          break;
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceHeld.current = false;
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  });

  // ── Drawing helpers ────────────────────────────────────────────────────

  function cancelDrawing() {
    if (currentPath.length > 0 && currentPathType) {
      // Finish as open path
      if (currentPath.length >= 2) {
        pushHistory();
        const newPath: PathData = { id: generateId(), points: [...currentPath], closed: false };
        if (currentPathType === 'outline') {
          onOutlineChange([...outlinePaths, newPath]);
        } else {
          onWallChange([...wallPaths, newPath]);
        }
      }
    }
    setCurrentPath([]);
    setCurrentPathType(null);
    setCursorPos(null);
    setRectDraw(null);
  }

  function deleteSelected() {
    if (!selectedId || !selectedType) return;
    pushHistory();
    if (selectedType === 'outline') {
      onOutlineChange(outlinePaths.filter(p => p.id !== selectedId));
    } else if (selectedType === 'wall') {
      onWallChange(wallPaths.filter(p => p.id !== selectedId));
    } else if (selectedType === 'highlight') {
      onSpaceHighlightsChange(spaceHighlights.filter(s => s.id !== selectedId));
    }
    setSelectedId(null);
    setSelectedType(null);
  }

  function finishLabelInput() {
    if (!labelInput) return;
    onSpaceHighlightsChange(
      spaceHighlights.map(s => s.id === labelInput.shapeId ? { ...s, label: labelInput.value || 'Untitled' } : s)
    );
    setLabelInput(null);
    setActiveTool('select');
    setSelectedId(labelInput.shapeId);
    setSelectedType('highlight');
  }

  function cancelLabelInput() {
    if (!labelInput) return;
    // Remove the shape if label is cancelled
    onSpaceHighlightsChange(spaceHighlights.filter(s => s.id !== labelInput.shapeId));
    setLabelInput(null);
  }

  // ── Hit testing ────────────────────────────────────────────────────────

  function hitTestPath(point: PathPoint, path: PathData, tolerance: number): boolean {
    for (let i = 0; i < path.points.length - 1; i++) {
      if (distToSegmentSq(point, path.points[i], path.points[i + 1]) < tolerance * tolerance) {
        return true;
      }
    }
    if (path.closed && path.points.length > 2) {
      if (distToSegmentSq(point, path.points[path.points.length - 1], path.points[0]) < tolerance * tolerance) {
        return true;
      }
      // Also check if point is inside the polygon
      if (isPointInPolygon(point, path.points)) return true;
    }
    return false;
  }

  function distToSegmentSq(p: PathPoint, v: PathPoint, w: PathPoint): number {
    const l2 = distanceSq(v, w);
    if (l2 === 0) return distanceSq(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return distanceSq(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
  }

  function isPointInPolygon(point: PathPoint, polygon: PathPoint[]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      if (((yi > point.y) !== (yj > point.y)) && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function hitTestShape(point: PathPoint, shape: ShapeData): boolean {
    return point.x >= shape.x && point.x <= shape.x + shape.width &&
           point.y >= shape.y && point.y <= shape.y + shape.height;
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    const imgPoint = screenToImage(e.clientX, e.clientY);

    // Panning with space held
    if (spaceHeld.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, panX: transform.panX, panY: transform.panY });
      e.preventDefault();
      return;
    }

    if (activeTool === 'select') {
      handleSelectMouseDown(imgPoint, e);
    } else if (activeTool === 'pen') {
      handlePenClick(imgPoint);
    } else if (activeTool === 'wall') {
      handleWallClick(imgPoint);
    } else if (activeTool === 'rect') {
      handleRectMouseDown(imgPoint);
    } else if (activeTool === 'eraser') {
      handleEraserClick(imgPoint);
    }
  }

  function handleSelectMouseDown(imgPoint: PathPoint, e: React.MouseEvent) {
    const tolerance = 8 / transform.scale;

    // Check if clicking on a control point of selected item
    if (selectedId && selectedType) {
      if (selectedType === 'outline' || selectedType === 'wall') {
        const paths = selectedType === 'outline' ? outlinePaths : wallPaths;
        const path = paths.find(p => p.id === selectedId);
        if (path) {
          for (let i = 0; i < path.points.length; i++) {
            if (distanceSq(imgPoint, path.points[i]) < (8 / transform.scale) ** 2) {
              setDragState({
                type: 'control',
                itemId: selectedId,
                itemType: selectedType,
                pointIndex: i,
                startMouse: imgPoint,
              });
              e.preventDefault();
              return;
            }
          }
        }
      }
    }

    // Hit test all items
    // Check highlights
    for (let i = spaceHighlights.length - 1; i >= 0; i--) {
      if (hitTestShape(imgPoint, spaceHighlights[i])) {
        setSelectedId(spaceHighlights[i].id);
        setSelectedType('highlight');
        setDragState({
          type: 'move',
          itemId: spaceHighlights[i].id,
          itemType: 'highlight',
          startMouse: imgPoint,
          startRect: { x: spaceHighlights[i].x, y: spaceHighlights[i].y },
        });
        e.preventDefault();
        return;
      }
    }

    // Check outlines
    for (let i = outlinePaths.length - 1; i >= 0; i--) {
      if (hitTestPath(imgPoint, outlinePaths[i], tolerance)) {
        setSelectedId(outlinePaths[i].id);
        setSelectedType('outline');
        setDragState({
          type: 'move',
          itemId: outlinePaths[i].id,
          itemType: 'outline',
          startMouse: imgPoint,
          startPoints: outlinePaths[i].points.map(p => ({ ...p })),
        });
        e.preventDefault();
        return;
      }
    }

    // Check walls
    for (let i = wallPaths.length - 1; i >= 0; i--) {
      if (hitTestPath(imgPoint, wallPaths[i], tolerance)) {
        setSelectedId(wallPaths[i].id);
        setSelectedType('wall');
        setDragState({
          type: 'move',
          itemId: wallPaths[i].id,
          itemType: 'wall',
          startMouse: imgPoint,
          startPoints: wallPaths[i].points.map(p => ({ ...p })),
        });
        e.preventDefault();
        return;
      }
    }

    // Nothing hit
    setSelectedId(null);
    setSelectedType(null);
  }

  function handlePenClick(imgPoint: PathPoint) {
    if (currentPathType === 'wall') return; // Wrong tool active for existing path

    if (currentPath.length === 0) {
      setCurrentPath([imgPoint]);
      setCurrentPathType('outline');
      return;
    }

    // Check if closing the path (clicking near first point)
    if (currentPath.length >= 3 && distanceSq(imgPoint, currentPath[0]) < CLOSE_THRESHOLD / (transform.scale * transform.scale) * 100) {
      pushHistory();
      const newPath: PathData = { id: generateId(), points: [...currentPath], closed: true };
      onOutlineChange([...outlinePaths, newPath]);
      setCurrentPath([]);
      setCurrentPathType(null);
      setActiveTool('select');
      setSelectedId(newPath.id);
      setSelectedType('outline');
      return;
    }

    setCurrentPath(prev => [...prev, imgPoint]);
  }

  function handlePenDoubleClick() {
    if (currentPath.length >= 2 && currentPathType === 'outline') {
      pushHistory();
      const newPath: PathData = { id: generateId(), points: [...currentPath], closed: true };
      onOutlineChange([...outlinePaths, newPath]);
      setCurrentPath([]);
      setCurrentPathType(null);
      setActiveTool('select');
      setSelectedId(newPath.id);
      setSelectedType('outline');
    }
  }

  function handleWallClick(imgPoint: PathPoint) {
    if (currentPathType === 'outline') return;

    if (currentPath.length === 0) {
      setCurrentPath([imgPoint]);
      setCurrentPathType('wall');
      return;
    }

    setCurrentPath(prev => [...prev, imgPoint]);
  }

  function handleWallDoubleClick() {
    if (currentPath.length >= 2 && currentPathType === 'wall') {
      pushHistory();
      const newPath: PathData = { id: generateId(), points: [...currentPath], closed: false };
      onWallChange([...wallPaths, newPath]);
      setCurrentPath([]);
      setCurrentPathType(null);
      setActiveTool('select');
      setSelectedId(newPath.id);
      setSelectedType('wall');
    }
  }

  function handleRectMouseDown(imgPoint: PathPoint) {
    setRectDraw({ startX: imgPoint.x, startY: imgPoint.y, endX: imgPoint.x, endY: imgPoint.y });
  }

  function handleEraserClick(imgPoint: PathPoint) {
    const tolerance = 8 / transform.scale;

    // Check highlights first
    for (let i = spaceHighlights.length - 1; i >= 0; i--) {
      if (hitTestShape(imgPoint, spaceHighlights[i])) {
        pushHistory();
        onSpaceHighlightsChange(spaceHighlights.filter((_, idx) => idx !== i));
        return;
      }
    }

    // Check outlines
    for (let i = outlinePaths.length - 1; i >= 0; i--) {
      if (hitTestPath(imgPoint, outlinePaths[i], tolerance)) {
        pushHistory();
        onOutlineChange(outlinePaths.filter((_, idx) => idx !== i));
        return;
      }
    }

    // Check walls
    for (let i = wallPaths.length - 1; i >= 0; i--) {
      if (hitTestPath(imgPoint, wallPaths[i], tolerance)) {
        pushHistory();
        onWallChange(wallPaths.filter((_, idx) => idx !== i));
        return;
      }
    }
  }

  function handleMouseMove(e: React.MouseEvent) {
    const imgPoint = screenToImage(e.clientX, e.clientY);

    // Panning
    if (isPanning && panStart) {
      setTransform(prev => ({
        ...prev,
        panX: panStart.panX + (e.clientX - panStart.x),
        panY: panStart.panY + (e.clientY - panStart.y),
      }));
      return;
    }

    // Drag in select mode
    if (dragState) {
      const dx = imgPoint.x - dragState.startMouse.x;
      const dy = imgPoint.y - dragState.startMouse.y;

      if (dragState.type === 'move') {
        if (dragState.itemType === 'highlight' && dragState.startRect) {
          onSpaceHighlightsChange(spaceHighlights.map(s =>
            s.id === dragState.itemId ? { ...s, x: dragState.startRect!.x + dx, y: dragState.startRect!.y + dy } : s
          ));
        } else if (dragState.startPoints) {
          const movedPoints = dragState.startPoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
          if (dragState.itemType === 'outline') {
            onOutlineChange(outlinePaths.map(p => p.id === dragState.itemId ? { ...p, points: movedPoints } : p));
          } else if (dragState.itemType === 'wall') {
            onWallChange(wallPaths.map(p => p.id === dragState.itemId ? { ...p, points: movedPoints } : p));
          }
        }
      } else if (dragState.type === 'control' && dragState.pointIndex !== undefined) {
        if (dragState.itemType === 'outline') {
          onOutlineChange(outlinePaths.map(p => {
            if (p.id !== dragState.itemId) return p;
            const newPoints = p.points.map((pt, i) => i === dragState.pointIndex ? imgPoint : pt);
            return { ...p, points: newPoints };
          }));
        } else if (dragState.itemType === 'wall') {
          onWallChange(wallPaths.map(p => {
            if (p.id !== dragState.itemId) return p;
            const newPoints = p.points.map((pt, i) => i === dragState.pointIndex ? imgPoint : pt);
            return { ...p, points: newPoints };
          }));
        }
      }
      return;
    }

    // Rect drawing
    if (rectDraw) {
      setRectDraw(prev => prev ? { ...prev, endX: imgPoint.x, endY: imgPoint.y } : null);
      return;
    }

    // Cursor tracking for pen/wall preview line
    if ((activeTool === 'pen' || activeTool === 'wall') && currentPath.length > 0) {
      setCursorPos(imgPoint);
    } else {
      setCursorPos(null);
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    // Finish panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Finish drag (push history on first move)
    if (dragState) {
      pushHistory();
      setDragState(null);
      return;
    }

    // Finish rect drawing
    if (rectDraw) {
      const x = Math.min(rectDraw.startX, rectDraw.endX);
      const y = Math.min(rectDraw.startY, rectDraw.endY);
      const w = Math.abs(rectDraw.endX - rectDraw.startX);
      const h = Math.abs(rectDraw.endY - rectDraw.startY);

      if (w > 10 && h > 10) {
        pushHistory();
        const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        const color = colors[spaceHighlights.length % colors.length];
        const newShape: ShapeData = {
          id: generateId(),
          label: '',
          type: 'rect',
          x, y, width: w, height: h,
          color,
        };
        onSpaceHighlightsChange([...spaceHighlights, newShape]);

        // Show label input
        const screenPos = imageToScreen(x + w / 2, y + h / 2);
        setLabelInput({ shapeId: newShape.id, x: screenPos.x, y: screenPos.y, value: '' });
      }
      setRectDraw(null);
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (activeTool === 'pen') {
      handlePenDoubleClick();
    } else if (activeTool === 'wall') {
      handleWallDoubleClick();
    }
  }

  // ── Cursor style ───────────────────────────────────────────────────────

  function getCursor(): string {
    if (isPanning || spaceHeld.current) return 'grab';
    if (activeTool === 'pen' || activeTool === 'wall' || activeTool === 'rect') return 'crosshair';
    if (activeTool === 'eraser') return 'pointer';
    return 'default';
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const viewTransform = `translate(${transform.panX}, ${transform.panY}) scale(${transform.scale})`;

  return (
    <div className="drawing-canvas-container">
      {/* Toolbar */}
      <div className="dc-toolbar">
        <div className="dc-toolbar-group">
          <ToolButton icon="select" label="Select" shortcut="V" active={activeTool === 'select'} onClick={() => { setActiveTool('select'); cancelDrawing(); }} />
          <ToolButton icon="pen" label="Pen" shortcut="P" active={activeTool === 'pen'} onClick={() => { setActiveTool('pen'); cancelDrawing(); }} />
          <ToolButton icon="wall" label="Wall" shortcut="W" active={activeTool === 'wall'} onClick={() => { setActiveTool('wall'); cancelDrawing(); }} />
          <ToolButton icon="rect" label="Rect" shortcut="R" active={activeTool === 'rect'} onClick={() => { setActiveTool('rect'); cancelDrawing(); }} />
          <ToolButton icon="eraser" label="Eraser" shortcut="E" active={activeTool === 'eraser'} onClick={() => { setActiveTool('eraser'); cancelDrawing(); }} />
        </div>

        <div className="dc-toolbar-sep" />

        <div className="dc-toolbar-group">
          <button className="dc-tool-btn" onClick={zoomIn} title="Zoom In (+)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="4.5" y1="7" x2="9.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="4.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button className="dc-tool-btn" onClick={zoomOut} title="Zoom Out (-)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"/><line x1="11" y1="11" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="4.5" y1="7" x2="9.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <button className="dc-tool-btn" onClick={fitToView} title="Fit to View">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/><rect x="5" y="5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <span className="dc-zoom-label">{Math.round(transform.scale * 100)}%</span>
        </div>

        <div className="dc-toolbar-sep" />

        <div className="dc-toolbar-group">
          <button className="dc-tool-btn" onClick={undo} title="Undo (Ctrl+Z)" disabled={history.length === 0}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6h6a3 3 0 0 1 0 6H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.5 3.5L4 6l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="dc-toolbar-sep" />

        <div className="dc-toolbar-group dc-layers">
          <label className="dc-layer-toggle">
            <input type="checkbox" checked={showOutlines} onChange={e => setShowOutlines(e.target.checked)} />
            <span className="dc-layer-swatch" style={{ background: '#4A2080' }} />
            Outline
          </label>
          <label className="dc-layer-toggle">
            <input type="checkbox" checked={showWalls} onChange={e => setShowWalls(e.target.checked)} />
            <span className="dc-layer-swatch" style={{ background: '#333333' }} />
            Walls
          </label>
          <label className="dc-layer-toggle">
            <input type="checkbox" checked={showHighlights} onChange={e => setShowHighlights(e.target.checked)} />
            <span className="dc-layer-swatch" style={{ background: '#3b82f6' }} />
            Highlights
          </label>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="dc-canvas"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isPanning) { setIsPanning(false); setPanStart(null); }
          if (dragState) { pushHistory(); setDragState(null); }
        }}
        onDoubleClick={handleDoubleClick}
      >
        <svg
          ref={svgRef}
          className="dc-svg"
          width="100%"
          height="100%"
        >
          <g transform={viewTransform}>
            {/* Background image */}
            <image
              href={imageUrl}
              x={0}
              y={0}
              width={imageWidth}
              height={imageHeight}
              style={{ pointerEvents: 'none' }}
            />

            {/* Outline paths */}
            {showOutlines && outlinePaths.map(path => (
              <path
                key={path.id}
                d={pointsToSvgPath(path.points, path.closed)}
                fill={path.closed ? 'rgba(74, 32, 128, 0.2)' : 'none'}
                stroke="#4A2080"
                strokeWidth={2 / transform.scale}
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Wall paths */}
            {showWalls && wallPaths.map(path => (
              <path
                key={path.id}
                d={pointsToSvgPath(path.points, path.closed)}
                fill="none"
                stroke="#333333"
                strokeWidth={3 / transform.scale}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              />
            ))}

            {/* Space highlights */}
            {showHighlights && spaceHighlights.map(shape => (
              <g key={shape.id}>
                <rect
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  fill={shape.color}
                  fillOpacity={0.3}
                  stroke={shape.color}
                  strokeWidth={1 / transform.scale}
                  strokeDasharray={`${4 / transform.scale} ${3 / transform.scale}`}
                  style={{ pointerEvents: 'none' }}
                />
                {shape.label && (
                  <text
                    x={shape.x + shape.width / 2}
                    y={shape.y + shape.height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={shape.color}
                    fontSize={Math.max(12, Math.min(shape.width / 6, 20)) / transform.scale}
                    fontFamily="Arial, sans-serif"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {shape.label}
                  </text>
                )}
              </g>
            ))}

            {/* Currently drawing path (pen/wall preview) */}
            {currentPath.length > 0 && (
              <>
                <path
                  d={pointsToSvgPath(currentPath, false) + (cursorPos ? ` L${cursorPos.x},${cursorPos.y}` : '')}
                  fill="none"
                  stroke={currentPathType === 'outline' ? '#4A2080' : '#333333'}
                  strokeWidth={(currentPathType === 'outline' ? 2 : 3) / transform.scale}
                  strokeDasharray={`${6 / transform.scale} ${3 / transform.scale}`}
                  strokeLinejoin="round"
                  style={{ pointerEvents: 'none' }}
                />
                {currentPath.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={4 / transform.scale}
                    fill={i === 0 ? '#ef4444' : '#ffffff'}
                    stroke={currentPathType === 'outline' ? '#4A2080' : '#333333'}
                    strokeWidth={1.5 / transform.scale}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
              </>
            )}

            {/* Rect drawing preview */}
            {rectDraw && (
              <rect
                x={Math.min(rectDraw.startX, rectDraw.endX)}
                y={Math.min(rectDraw.startY, rectDraw.endY)}
                width={Math.abs(rectDraw.endX - rectDraw.startX)}
                height={Math.abs(rectDraw.endY - rectDraw.startY)}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={1.5 / transform.scale}
                strokeDasharray={`${5 / transform.scale} ${3 / transform.scale}`}
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Selection control points */}
            {activeTool === 'select' && selectedId && selectedType && (
              <>
                {(selectedType === 'outline' || selectedType === 'wall') && (() => {
                  const paths = selectedType === 'outline' ? outlinePaths : wallPaths;
                  const path = paths.find(p => p.id === selectedId);
                  if (!path) return null;
                  return (
                    <>
                      {/* Highlight selected path */}
                      <path
                        d={pointsToSvgPath(path.points, path.closed)}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={1.5 / transform.scale}
                        strokeDasharray={`${4 / transform.scale} ${2 / transform.scale}`}
                        style={{ pointerEvents: 'none' }}
                      />
                      {path.points.map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.x}
                          cy={pt.y}
                          r={6 / transform.scale}
                          fill="#ffffff"
                          stroke="#3b82f6"
                          strokeWidth={2 / transform.scale}
                          style={{ cursor: 'move', pointerEvents: 'all' }}
                        />
                      ))}
                    </>
                  );
                })()}
                {selectedType === 'highlight' && (() => {
                  const shape = spaceHighlights.find(s => s.id === selectedId);
                  if (!shape) return null;
                  return (
                    <rect
                      x={shape.x}
                      y={shape.y}
                      width={shape.width}
                      height={shape.height}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2 / transform.scale}
                      strokeDasharray={`${4 / transform.scale} ${2 / transform.scale}`}
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                })()}
              </>
            )}
          </g>
        </svg>

        {/* Inline label input for rect tool */}
        {labelInput && (
          <div
            className="dc-label-input"
            style={{
              left: labelInput.x,
              top: labelInput.y,
            }}
          >
            <input
              autoFocus
              type="text"
              placeholder="Label..."
              value={labelInput.value}
              onChange={e => setLabelInput(prev => prev ? { ...prev, value: e.target.value } : null)}
              onKeyDown={e => {
                if (e.key === 'Enter') finishLabelInput();
                if (e.key === 'Escape') cancelLabelInput();
              }}
              onBlur={finishLabelInput}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tool Button ──────────────────────────────────────────────────────────────

function ToolButton({ icon, label, shortcut, active, onClick }: {
  icon: string;
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`dc-tool-btn ${active ? 'dc-tool-btn--active' : ''}`}
      onClick={onClick}
      title={`${label} (${shortcut})`}
    >
      <ToolIcon type={icon} />
      <span className="dc-tool-label">{label}</span>
    </button>
  );
}

function ToolIcon({ type }: { type: string }) {
  switch (type) {
    case 'select':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 2l8 6-3.5.5-.5 3.5L3 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15"/>
        </svg>
      );
    case 'pen':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 14L5 3l4 4 4-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="5" cy="3" r="1.5" fill="currentColor"/>
          <circle cx="9" cy="7" r="1.5" fill="currentColor"/>
        </svg>
      );
    case 'wall':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 13V3h12v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
          <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      );
    case 'rect':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="3.5" width="11" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="currentColor" fillOpacity="0.1"/>
        </svg>
      );
    case 'eraser':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 14h7M3.5 11.5l7-7a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-7 7-3.5-3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      );
    default:
      return null;
  }
}
