import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface MarketUniverseProps {
  activeMarket: number;
  sentiment: number;
  volatility: number;
}

const marketColors = [0x38d5ff, 0x7c5cff, 0x42e3a3, 0xff647c];

export function MarketUniverse({ activeMarket, sentiment, volatility }: MarketUniverseProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ activeMarket, sentiment, volatility });

  useEffect(() => {
    stateRef.current = { activeMarket, sentiment, volatility };
  }, [activeMarket, sentiment, volatility]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    camera.position.set(0, 3.2, 9.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0x88aaff, 0.7);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x38d5ff, 36, 20);
    keyLight.position.set(-4, 5, 6);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x7c5cff, 26, 18);
    fillLight.position.set(5, -2, 5);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(14, 32, 0x1f6f92, 0x23324a);
    grid.position.y = -1.4;
    root.add(grid);

    const rings = Array.from({ length: 4 }, (_, index) => {
      const geometry = new THREE.TorusGeometry(1.55 + index * 0.78, 0.01, 10, 140);
      const material = new THREE.MeshBasicMaterial({
        color: marketColors[index],
        transparent: true,
        opacity: index === stateRef.current.activeMarket ? 0.66 : 0.2,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -1.22 + index * 0.05;
      root.add(ring);
      return { ring, material };
    });

    const bars = Array.from({ length: 36 }, (_, index) => {
      const angle = (index / 36) * Math.PI * 2;
      const radius = 2.2 + (index % 4) * 0.55;
      const height = 0.45 + ((index * 7) % 11) * 0.18;
      const geometry = new THREE.BoxGeometry(0.12, height, 0.12);
      const material = new THREE.MeshStandardMaterial({
        color: marketColors[index % marketColors.length],
        emissive: marketColors[index % marketColors.length],
        emissiveIntensity: 0.18,
        metalness: 0.2,
        roughness: 0.34,
      });
      const bar = new THREE.Mesh(geometry, material);
      bar.position.set(Math.cos(angle) * radius, -1.2 + height / 2, Math.sin(angle) * radius);
      bar.rotation.y = -angle;
      root.add(bar);
      return { bar, material, baseHeight: height, market: index % marketColors.length };
    });

    const strandMaterial = new THREE.LineBasicMaterial({ color: 0x38d5ff, transparent: true, opacity: 0.18 });
    const strandGeometry = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 96 }, (_, index) => {
        const t = index / 95;
        const angle = t * Math.PI * 6;
        const radius = 0.4 + t * 4.2;
        return new THREE.Vector3(Math.cos(angle) * radius, -0.4 + Math.sin(t * Math.PI * 2) * 0.9, Math.sin(angle) * radius);
      }),
    );
    const strand = new THREE.Line(strandGeometry, strandMaterial);
    root.add(strand);

    const pointer = { x: 0, y: 0 };
    const handlePointer = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    host.addEventListener('pointermove', handlePointer);

    const resize = () => {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 360);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frame = 0;
    let raf = 0;

    const animate = () => {
      frame += 0.012;
      const { activeMarket: currentMarket, sentiment: currentSentiment, volatility: currentVolatility } = stateRef.current;
      const sentimentScale = 0.75 + currentSentiment / 160;
      const volatilityScale = 0.75 + currentVolatility / 120;

      root.rotation.y += 0.0025;
      root.rotation.x += (pointer.y * 0.16 - root.rotation.x) * 0.025;
      root.rotation.z += (-pointer.x * 0.08 - root.rotation.z) * 0.025;
      camera.position.x += (pointer.x * 0.7 - camera.position.x) * 0.02;
      camera.lookAt(0, 0, 0);

      rings.forEach(({ ring, material }, index) => {
        material.opacity += ((index === currentMarket ? 0.72 : 0.18) - material.opacity) * 0.06;
        ring.scale.setScalar(1 + Math.sin(frame * 2 + index) * 0.018 + (index === currentMarket ? 0.06 : 0));
      });

      bars.forEach(({ bar, material, baseHeight, market }, index) => {
        const targetHeight =
          baseHeight * (market === currentMarket ? 1.55 : 0.92) * sentimentScale +
          Math.sin(frame * (1.5 + currentVolatility / 90) + index) * 0.15 * volatilityScale;
        bar.scale.y += (Math.max(0.2, targetHeight) - bar.scale.y) * 0.08;
        material.emissiveIntensity += ((market === currentMarket ? 0.55 : 0.12) - material.emissiveIntensity) * 0.06;
      });

      strand.rotation.y -= 0.004;
      strandMaterial.opacity = 0.18 + Math.sin(frame * 3) * 0.04;

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      host.removeEventListener('pointermove', handlePointer);
      host.removeChild(renderer.domElement);
      renderer.dispose();
      grid.geometry.dispose();
      strandGeometry.dispose();
      strandMaterial.dispose();
      rings.forEach(({ ring, material }) => {
        ring.geometry.dispose();
        material.dispose();
      });
      bars.forEach(({ bar, material }) => {
        bar.geometry.dispose();
        material.dispose();
      });
    };
  }, []);

  return <div className="market-universe" ref={hostRef} aria-hidden="true" />;
}
