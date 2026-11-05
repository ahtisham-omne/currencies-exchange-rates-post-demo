/**
 * DxfViewer — parses DXF files with `dxf-parser` and renders them with Three.js.
 * Supports LINE, CIRCLE, ARC, LWPOLYLINE, POLYLINE, ELLIPSE, SPLINE entities.
 * Pan/zoom handled by OrbitControls; orthographic camera fits the drawing bounds.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  url: string;
  fileName: string;
}

export function DxfViewer({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let renderer: any;
    let controls: any;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const DxfParserMod: any = await import("dxf-parser");
        const DxfParser = DxfParserMod.default || DxfParserMod;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const text = await res.text();
        if (cancelled) return;

        const parser = new DxfParser();
        const dxf: any = parser.parseSync(text);
        if (!dxf) throw new Error("Failed to parse DXF");

        const canvas = canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement!;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height, false);

        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10000, 10000);

        const defaultColor = 0x0f1729;
        const colorFor = (e: any) =>
          typeof e?.color === "number" && e.color > 0 ? new THREE.Color(e.color) : new THREE.Color(defaultColor);

        const addLine = (points: any[], color: any) => {
          if (points.length < 2) return;
          const geom = new THREE.BufferGeometry().setFromPoints(points);
          const mat = new THREE.LineBasicMaterial({ color });
          scene.add(new THREE.Line(geom, mat));
        };

        const entities: any[] = Array.isArray(dxf.entities) ? dxf.entities : [];
        entities.forEach((entity: any) => {
          try {
            const color = colorFor(entity);
            const t = entity.type;
            if (t === "LINE" && entity.vertices?.length >= 2) {
              addLine(
                [
                  new THREE.Vector3(entity.vertices[0].x || 0, entity.vertices[0].y || 0, 0),
                  new THREE.Vector3(entity.vertices[1].x || 0, entity.vertices[1].y || 0, 0),
                ],
                color,
              );
            } else if (t === "CIRCLE" && entity.center) {
              const curve = new THREE.EllipseCurve(
                entity.center.x || 0,
                entity.center.y || 0,
                entity.radius || 0,
                entity.radius || 0,
                0,
                Math.PI * 2,
                false,
                0,
              );
              const pts = curve.getPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0));
              addLine(pts, color);
            } else if (t === "ARC" && entity.center) {
              const start = THREE.MathUtils.degToRad(entity.startAngle ?? 0);
              const end = THREE.MathUtils.degToRad(entity.endAngle ?? 0);
              const curve = new THREE.EllipseCurve(
                entity.center.x || 0,
                entity.center.y || 0,
                entity.radius || 0,
                entity.radius || 0,
                start,
                end,
                false,
                0,
              );
              const pts = curve.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0));
              addLine(pts, color);
            } else if (t === "ELLIPSE" && entity.center) {
              const rx = Math.hypot(entity.majorAxisEndPoint?.x || 0, entity.majorAxisEndPoint?.y || 0);
              const ry = rx * (entity.axisRatio ?? 1);
              const rot = Math.atan2(entity.majorAxisEndPoint?.y || 0, entity.majorAxisEndPoint?.x || 0);
              const curve = new THREE.EllipseCurve(
                entity.center.x || 0,
                entity.center.y || 0,
                rx,
                ry,
                entity.startAngle ?? 0,
                entity.endAngle ?? Math.PI * 2,
                false,
                rot,
              );
              const pts = curve.getPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0));
              addLine(pts, color);
            } else if ((t === "LWPOLYLINE" || t === "POLYLINE") && entity.vertices?.length) {
              const pts = entity.vertices.map((v: any) => new THREE.Vector3(v.x || 0, v.y || 0, 0));
              if (entity.shape || entity.closed) pts.push(pts[0].clone());
              addLine(pts, color);
            } else if (t === "SPLINE" && entity.controlPoints?.length) {
              const pts = entity.controlPoints.map((v: any) => new THREE.Vector3(v.x || 0, v.y || 0, 0));
              addLine(pts, color);
            } else if (t === "POINT" && entity.position) {
              const geom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(entity.position.x || 0, entity.position.y || 0, 0),
              ]);
              scene.add(new THREE.Points(geom, new THREE.PointsMaterial({ color, size: 2 })));
            }
          } catch { /* skip malformed entity */ }
        });

        // Fit camera
        const box = new THREE.Box3().setFromObject(scene);
        if (!isFinite(box.min.x) || box.isEmpty()) {
          throw new Error("No renderable entities in DXF");
        }
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y) || 1;
        const aspect = width / height;
        const half = maxDim * 0.6;
        camera.left = center.x - half * aspect;
        camera.right = center.x + half * aspect;
        camera.top = center.y + half;
        camera.bottom = center.y - half;
        camera.position.set(center.x, center.y, 100);
        camera.updateProjectionMatrix();

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableRotate = false;
        controls.enableDamping = true;
        controls.target.set(center.x, center.y, 0);
        controls.mouseButtons = {
          LEFT: 2 /* PAN */,
          MIDDLE: 1 /* DOLLY */,
          RIGHT: 2 /* PAN */,
        };
        controls.touches = { ONE: 2 /* PAN */, TWO: 1 /* DOLLY_PAN */ };
        controls.update();

        const animate = () => {
          if (cancelled) return;
          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(animate);
        };
        animate();

        resizeObs = new ResizeObserver(() => {
          const w = parent.clientWidth;
          const h = parent.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h, false);
          const a = w / h;
          const halfH = (camera.top - camera.bottom) / 2;
          const cx = (camera.left + camera.right) / 2;
          camera.left = cx - halfH * a;
          camera.right = cx + halfH * a;
          camera.updateProjectionMatrix();
        });
        resizeObs.observe(parent);

        setLoading(false);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("DXF viewer error:", e);
        if (!cancelled) {
          setError(e?.message || "Failed to render DXF");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resizeObs?.disconnect();
      try { controls?.dispose?.(); } catch { /* noop */ }
      try { renderer?.dispose?.(); } catch { /* noop */ }
    };
  }, [url]);

  return (
    <div className="relative w-full h-full" style={{ background: "#ffffff" }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.7)" }}>
          <Loader2 className="animate-spin" size={28} style={{ color: "var(--piw-primary)" }} />
        </div>
      )}
      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center text-sm"
          style={{ color: "var(--text-secondary)", padding: 16, textAlign: "center" }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
