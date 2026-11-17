import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { Point, Stroke, StrokeTool } from "../../../shared/protocol.js";

interface DrawingCanvasProps {
  strokes: Stroke[];
  enabled: boolean;
  color: string;
  size: number;
  tool: StrokeTool;
  onStart: (point: Point) => void;
  onMove: (point: Point) => void;
  onEnd: () => void;
}

const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 620;

function drawStroke(
  context: CanvasRenderingContext2D,
  stroke: Stroke,
  fromIndex = 0,
): void {
  const points = stroke.points;
  if (!points.length) return;
  context.save();
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x * CANVAS_WIDTH, points[0].y * CANVAS_HEIGHT, stroke.size / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    const start = Math.max(1, fromIndex);
    context.beginPath();
    context.moveTo(points[start - 1].x * CANVAS_WIDTH, points[start - 1].y * CANVAS_HEIGHT);
    for (let index = start; index < points.length; index += 1) {
      context.lineTo(points[index].x * CANVAS_WIDTH, points[index].y * CANVAS_HEIGHT);
    }
    context.stroke();
  }
  context.restore();
}

export default function DrawingCanvas({
  strokes,
  enabled,
  color,
  size,
  tool,
  onStart,
  onMove,
  onEnd,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointer = useRef<number | null>(null);
  const drawnStrokeCount = useRef(0);
  const drawnPointCounts = useRef(new Map<string, number>());

  const redrawAll = useCallback((items: Stroke[]) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const stroke of items) drawStroke(context, stroke);
    drawnStrokeCount.current = items.length;
    drawnPointCounts.current = new Map(items.map((stroke) => [stroke.id, stroke.points.length]));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;

    const isRemoval = strokes.length < drawnStrokeCount.current;
    if (isRemoval) {
      redrawAll(strokes);
      return;
    }

    for (let index = 0; index < strokes.length; index += 1) {
      const stroke = strokes[index];
      const previousCount = drawnPointCounts.current.get(stroke.id) ?? 0;
      if (previousCount === 0 || index >= drawnStrokeCount.current) {
        drawStroke(context, stroke);
      } else if (stroke.points.length > previousCount) {
        drawStroke(context, stroke, previousCount);
      }
      drawnPointCounts.current.set(stroke.id, stroke.points.length);
    }
    drawnStrokeCount.current = strokes.length;
  }, [redrawAll, strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width === width && canvas.height === height) return;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context?.scale(width / CANVAS_WIDTH, height / CANVAS_HEIGHT);
      redrawAll(strokes);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [redrawAll, strokes]);

  const getPoint = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || event.button !== 0) return;
    event.preventDefault();
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    onStart(getPoint(event));
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!enabled || activePointer.current !== event.pointerId) return;
    onMove(getPoint(event));
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== event.pointerId) return;
    activePointer.current = null;
    onEnd();
  };

  return (
    <canvas
      ref={canvasRef}
      className={`drawing-canvas${enabled ? " drawing-canvas--enabled" : ""}`}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-label={enabled ? "Drawing canvas" : "Shared drawing canvas"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: "none", cursor: enabled ? (tool === "eraser" ? "cell" : "crosshair") : "default" }}
      data-color={color}
      data-size={size}
    />
  );
}
