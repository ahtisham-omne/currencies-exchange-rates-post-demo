/**
 * StlViewer — renders STL 3D models with Three.js + OrbitControls.
 * User can adjust mesh color and background via the overlay toolbar.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  url: string;
}


export function StlViewer({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meshRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelColor, setModelColor] = useState("#8899aa");
  const [bgColor, setBgColor] = useState("#ffffff");

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let scene: any, camera: any, renderer: any, controls: any;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      try {
        const THREE = await import("three");
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const parent = canvas.parentElement!;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height, false);
        renderer.setClearColor(bgColor);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const key = new THREE.DirectionalLight(0xffffff, 0.9);
        key.position.set(3, 6, 4);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far = 200;
        key.shadow.bias = -0.0005;
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.35);
        fill.position.set(-4, 2, -3);
        scene.add(fill);

        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const loader = new STLLoader();
        const geometry = loader.parse(buf);
        geometry.computeBoundingBox();
        geometry.center();
        const material = new THREE.MeshStandardMaterial({
          color: modelColor,
          roughness: 0.55,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshRef.current = mesh;
        scene.add(mesh);

        const box = geometry.boundingBox!;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(maxDim * 12, maxDim * 12),
          new THREE.ShadowMaterial({ opacity: 0.18 }),
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -size.y / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const shadowCam = key.shadow.camera as any;
        shadowCam.left = -maxDim * 3;
        shadowCam.right = maxDim * 3;
        shadowCam.top = maxDim * 3;
        shadowCam.bottom = -maxDim * 3;
        shadowCam.updateProjectionMatrix();

        const dist = maxDim * 2.2;
        camera.position.set(dist, dist, dist);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
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
          if (w && h) {
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
          }
        });
        resizeObs.observe(parent);

        setLoading(false);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error("STL viewer error:", e);
        if (!cancelled) {
          setError(e?.message || "Failed to render STL");
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
      try { meshRef.current?.geometry?.dispose?.(); } catch { /* noop */ }
      try { meshRef.current?.material?.dispose?.(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const m = meshRef.current;
    if (m?.material) m.material.color.set(modelColor);
  }, [modelColor]);

  useEffect(() => {
    const r = rendererRef.current;
    if (r) r.setClearColor(bgColor);
  }, [bgColor]);

  return (
    <div className="relative w-full h-full" style={{ background: bgColor }}>
      <canvas ref={canvasRef} className="w-full h-full flex-1 block" />
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-1 rounded-full"
        style={{
          background: "var(--piw-card)",
          border: "1px solid var(--piw-border)",
          boxShadow: "0px 4px 16px -4px rgba(16,24,40,0.12), 0px 2px 6px -2px rgba(16,24,40,0.06)",
          zIndex: 2,
          fontFamily: "var(--font-inter)",
          fontSize: 12,
          fontWeight: 500,
          color: "#0F1729",
          height: 36,
        }}
      >
        <ColorSwatch label="Model" value={modelColor} onChange={setModelColor} />
        <div style={{ width: 1, height: 16, background: "var(--piw-border)" }} />
        <ColorSwatch label="Background" value={bgColor} onChange={setBgColor} />
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.6)" }}>
          <Loader2 className="animate-spin" size={28} style={{ color: "var(--piw-primary)" }} />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: "var(--text-secondary)", padding: 16, textAlign: "center" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="flex items-center gap-1.5 cursor-pointer rounded-full px-2 h-7 transition-colors active:scale-[0.97]"
      style={{ color: "#0F1729", background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(210, 100%, 96%)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      aria-label={`Choose ${label} color`}
    >
      <span
        style={{
          position: "relative",
          width: 16,
          height: 16,
          borderRadius: 4,
          background: value,
          border: "1px solid var(--piw-border)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            border: "none",
            padding: 0,
            background: "transparent",
          }}
        />
      </span>
      <span>{label}</span>
    </label>
  );
}

