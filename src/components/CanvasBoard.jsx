import React, { useEffect, useRef } from "react";
import { useSocket } from "../contexts/SocketContext";

/**
 * CanvasBoard with per-stroke IDs to avoid cross-stroke bridging.
 *
 * Protocol (client-only additions):
 * - strokeStart: { x, y, strokeId, color, size }
 * - drawBatch:  { points: [{x,y},...], strokeId, color, size }
 * - strokeEnd:  { strokeId }
 *
 * Server is expected to broadcast the events as-is (no server changes required).
 */

const W = 800;
const H = 600;
const FLUSH_MS = 35; // flush throttle
const MAX_BUFFER = 1000;

function makeStrokeId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}

export default function CanvasBoard({ isDrawer, pushToast, gameStarted }) {
  const socket = useSocket();
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  // local drawer state
  const drawingRef = useRef(false);
  const currentStrokeIdRef = useRef(null);
  const bufferRef = useRef([]); // points for current stroke

  // color state
  const [penColor, setPenColor] = React.useState("#000");

  // flush timer
  const flushTimerRef = useRef(null);

  // remote strokes active map
  // keys: strokeId -> { active: bool }  (we do no cross-stroke linking)
  const remoteActiveRef = useRef(new Map());
  
  // set up canvas and flush timer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;

  const handleGameOver = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  socket.on("roundEnded",()=>{
    handleGameOver()})


    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(W * ratio);
    canvas.height = Math.floor(H * ratio);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // white background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    // start buffer flush
    flushTimerRef.current = setInterval(() => {
      const buf = bufferRef.current;
      if (!buf.length || !socket) return;

      // All buffered points belong to the same current strokeId (we push only current stroke points)
      const strokeId = currentStrokeIdRef.current;
      if (!strokeId) {
        // no active stroke (may happen if pointerup happened quickly); clear buffer
        bufferRef.current = [];
        return;
      }

      // send a shallow copy
      const toSend = buf.splice(0);
      // validate
      const safePoints = toSend.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
      if (!safePoints.length) return;

      const payload = {
        points: safePoints,
        strokeId,
        // color: "#000",
        color: penColor,
        size: 2,
      };

      try {
        socket.emit("drawBatch", payload);
      } catch (err) {
        console.warn("emit drawBatch failed", err);
      }
    }, FLUSH_MS);

    return () => {
      clearInterval(flushTimerRef.current);
    };
  }, [socket]);

  // socket listeners for remote drawing keyed by strokeId
  useEffect(() => {
    if (!socket) return;
    const ctx = ctxRef.current;

    const onStrokeStart = (p) => {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      const id = String(p.strokeId || "");
      if (!id) return;
      remoteActiveRef.current.set(id, true);
      try {
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      } catch (err) {
        console.warn("remote strokeStart draw error", err);
      }
    };

    const onDrawBatch = (payload) => {
      if (!payload || !Array.isArray(payload.points) || payload.points.length === 0) return;
      const id = String(payload.strokeId || "");
      if (!id) return;

      const safePoints = payload.points.filter(pt => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y));
      if (!safePoints.length) return;

      try {
        if (!ctx) return;
        ctx.lineWidth = payload.size || 2;
        ctx.strokeStyle = payload.color || "#000";

        // If stroke wasn't started (race), start it at first point (this does NOT reconnect to previous strokes)
        if (!remoteActiveRef.current.get(id)) {
          remoteActiveRef.current.set(id, true);
          const first = safePoints[0];
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);

          // draw remaining points (if more than 1)
          for (let i = 1; i < safePoints.length; i++) {
            const pt = safePoints[i];
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        } else {
          // normal continuation of this stroke: append all points
          for (const pt of safePoints) {
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      } catch (err) {
        console.warn("remote drawBatch error", err);
      }
    };

    const onStrokeEnd = (p) => {
      const id = String((p && p.strokeId) || "");
      if (id) remoteActiveRef.current.delete(id);
      try {
        if (ctx) ctx.closePath();
      } catch (err) {}
    };

    socket.on("strokeStart", onStrokeStart);
    socket.on("drawBatch", onDrawBatch);
    socket.on("strokeEnd", onStrokeEnd);

    return () => {
      socket.off("strokeStart", onStrokeStart);
      socket.off("drawBatch", onDrawBatch);
      socket.off("strokeEnd", onStrokeEnd);
    };
  }, [socket]);

  // pointer handlers for drawer
  // function getPointerPos(e) {
  //   const r = canvasRef.current.getBoundingClientRect();
  //   const clientX = e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
  //   const clientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY);
  //   return { x: Math.round(clientX - r.left), y: Math.round(clientY - r.top) };
  // }

function getPointerPos(e) {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };

  const rect = canvas.getBoundingClientRect();

  const clientX =
    e.clientX ?? (e.touches && e.touches[0] && e.touches[0].clientX);
  const clientY =
    e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY);

  // guard for weird cases
  if (!rect.width || !rect.height) return { x: 0, y: 0 };

  // Map CSS coords -> canvas logical coords (W x H)
  const x = (clientX - rect.left) * (W / rect.width);
  const y = (clientY - rect.top) * (H / rect.height);

  return { x: Math.round(x), y: Math.round(y) };
}

  function handlePointerDown(e) {
    if (!isDrawer) return;
    const pos = getPointerPos(e);
    drawingRef.current = true;
    // new stroke id
    const sid = makeStrokeId();
    currentStrokeIdRef.current = sid;
    bufferRef.current = []; // clear any old buffer
    const ctx = ctxRef.current;
    try {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    } catch (_) {}
    // emit strokeStart with strokeId
    try {
      socket && socket.emit("strokeStart", { x: pos.x, y: pos.y, strokeId: sid, color: penColor, size: 2 });
    } catch (err) { console.warn("emit strokeStart fail", err); }
    e.preventDefault();
  }

  function handlePointerMove(e) {
    if (!drawingRef.current || !isDrawer) return;
    const pos = getPointerPos(e);
    const ctx = ctxRef.current;
    try {
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    } catch (_) {}
    // buffer for flush
    bufferRef.current.push({ x: pos.x, y: pos.y });
    if (bufferRef.current.length > MAX_BUFFER) bufferRef.current.splice(0, bufferRef.current.length - MAX_BUFFER);
    e.preventDefault();
  }

  function handlePointerUp() {
    if (!isDrawer) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const sid = currentStrokeIdRef.current;
    currentStrokeIdRef.current = null;
    // flush any leftover immediately
    const leftover = bufferRef.current.splice(0);
    if (leftover.length && socket && sid) {
      try {
        socket.emit("drawBatch", { points: leftover, strokeId: sid, color: penColor, size: 2 });
      } catch (err) { console.warn("emit final drawBatch failed", err); }
    }
    // emit strokeEnd
    try {
      socket && socket.emit("strokeEnd", { strokeId: sid });
    } catch (err) { console.warn("emit strokeEnd failed", err); }
  }

  function clearLocal() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    socket && socket.emit("clearCanvas");
    pushToast?.("Canvas cleared");
  }

  return (
    <div className="canvas-area">
      <div className="canvas-controls">
        <button onClick={clearLocal}>Clear</button>
        {isDrawer && (
    <input
      type="color"
      value={penColor}
      onChange={(e) => setPenColor(e.target.value)}
      style={{ marginLeft: "8px" }}
    />
  )}

      {gameStarted && <div className="drawer-guesser">{isDrawer ? "You are the drawer" : "Guess the drawing! (You can't draw in this round)!"}</div>}
        
      </div>

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="board"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: "none", background: "#fff", borderRadius: 6 }}
        />
      </div>
    </div>
  );
}
