"use client";
import { useEffect, useRef, useState } from "react";
import { Pause, RotateCw } from "lucide-react";

/** km/h → colour on the same scale as the corner chips: orange (slow) → yellow → green (fast). */
function speedRgb(kmh: number): [number, number, number] {
  const f = Math.min(1, Math.max(0, (kmh - 80) / 240)); // 80 km/h … 320 km/h
  const hue = (25 + f * 105) / 360; // 25° orange → 130° green
  const s = 0.85, l = 0.55;
  const k = (n: number) => (n + hue * 12) % 12, a = s * Math.min(l, 1 - l);
  const c = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [c(0), c(8), c(4)];
}

/**
 * Rotating 3D model of the circuit from one real lap: x/y from the car's position, height from its elevation
 * (exaggerated so hills show), colour from its speed. Drag to orbit, scroll to zoom.
 */
export function Track3D({ points, height = 340 }: { points: [number, number, number, number][]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{ autoRotate: boolean } | null>(null);
  // spins by default, except for people who asked their OS for reduced motion (they can still press play)
  const [spin, setSpin] = useState(true);
  useEffect(() => { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setSpin(false); }, []);
  const spinRef = useRef(spin);
  useEffect(() => { spinRef.current = spin; if (controlsRef.current) controlsRef.current.autoRotate = spin; }, [spin]);

  useEffect(() => {
    const el = ref.current;
    if (!el || points.length < 20) return;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (cancelled) return;

      const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]), zs = points.map((p) => p[2]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, z0 = Math.min(...zs);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
      const s = 10 / span;
      const lift = Math.min(4, 1.2 / Math.max((Math.max(...zs) - z0) * s, 0.05)); // exaggerate elevation, ~1.2 units of relief max
      // track x/y → three's x/z (ground plane), elevation → three's y (up)
      const pts = points.map(([x, y, z]) => new THREE.Vector3((x - cx) * s, (z - z0) * s * lift, -(y - cy) * s));

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, el.clientWidth / el.clientHeight, 0.1, 200);
      // frame the whole circuit: distance so its bounding circle fits the narrower of the two fields of view
      const radius = Math.max(...pts.map((p) => Math.hypot(p.x, p.z))) * 1.08;
      const vfov = (camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const dist = radius / Math.sin(Math.min(vfov, hfov) / 2);
      camera.position.set(0, dist * 0.57, dist * 0.82); // ~35° above the horizon
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(5, 12, 6);
      scene.add(sun);

      // the track: a tube along the lap, coloured by speed
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const segments = pts.length * 3;
      const tube = new THREE.TubeGeometry(curve, segments, 0.1, 8, true);
      const colours: number[] = [];
      const ring = 9; // radialSegments + 1 vertices per ring
      for (let i = 0; i <= segments; i++) {
        const sp = points[Math.min(points.length - 1, Math.floor((i / segments) * points.length))][3];
        const [r, g, b] = speedRgb(sp);
        for (let k = 0; k < ring; k++) colours.push(r, g, b);
      }
      tube.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
      const tubeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
      scene.add(new THREE.Mesh(tube, tubeMat));

      // faint "shadow" of the layout on the ground, so height differences read clearly
      const flat = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, -0.02, p.z)));
      const flatMat = new THREE.LineBasicMaterial({ color: 0x3f3f46 });
      scene.add(new THREE.LineLoop(flat, flatMat));
      const grid = new THREE.GridHelper(14, 28, 0x27272a, 0x18181b);
      grid.position.y = -0.03;
      scene.add(grid);

      // start / finish marker
      const startGeo = new THREE.BoxGeometry(0.08, 0.5, 0.5);
      const startMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const start = new THREE.Mesh(startGeo, startMat);
      start.position.copy(pts[0]).add(new THREE.Vector3(0, 0.2, 0));
      start.lookAt(pts[1].clone().add(new THREE.Vector3(0, 0.2, 0)));
      scene.add(start);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = dist * 0.35;
      controls.maxDistance = dist * 2.5;
      controls.maxPolarAngle = Math.PI * 0.48; // never look from underneath
      controls.autoRotate = spinRef.current;
      controls.autoRotateSpeed = 1.2;
      controlsRef.current = controls;

      let raf = 0, last = performance.now();
      const loop = () => {
        const now = performance.now();
        controls.update((now - last) / 1000); // time-based, so it turns at the same speed at any frame rate (~1 turn / 50 s)
        last = now;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      loop();
      const ro = new ResizeObserver(() => {
        renderer.setSize(el.clientWidth, el.clientHeight);
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      stop = () => {
        controlsRef.current = null;
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        [tube, flat, startGeo].forEach((g) => g.dispose());
        [tubeMat, flatMat, startMat].forEach((m) => m.dispose());
        grid.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => { cancelled = true; stop(); };
  }, [points]);

  return (
    <div className="relative">
      <div ref={ref} style={{ height }} className="w-full cursor-grab active:cursor-grabbing" role="img" aria-label="3D model of the circuit, coloured by speed" />
      <button onClick={() => setSpin((x) => !x)} aria-label={spin ? "Stop rotating" : "Rotate the model"} title={spin ? "Stop rotating" : "Rotate"}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-neutral-700 bg-neutral-900/90 hover:bg-neutral-800">
        {spin ? <Pause size={14} /> : <RotateCw size={14} />}
      </button>
    </div>
  );
}
