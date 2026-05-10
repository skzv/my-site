// ParticleWave.jsx — faithful port of the Three.js wave in skzv/my-site.
// White points on black, mouse-eased camera, stacked sine displacement.
// Renders into a <canvas> via a passed-in Three module (loaded from Skypack).
const { useEffect, useRef } = React;

function ParticleWave({ amountX = 200, amountY = 200, separation = 100 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let raf;
    let scene, camera, renderer, particles, count = 0;
    let mouseX = 0, mouseY = 0;
    let halfX = window.innerWidth / 2;
    let halfY = window.innerHeight / 2;
    let mounted = true;

    (async () => {
      const THREE = window.THREE;
      if (!THREE || !mounted) return;

      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
      camera.position.y = 2000;
      camera.position.z = 1000;

      scene = new THREE.Scene();

      const numParticles = amountX * amountY;
      const positions = new Float32Array(numParticles * 3);
      const scales = new Float32Array(numParticles);
      let i = 0, j = 0;
      for (let ix = 0; ix < amountX; ix++) {
        for (let iy = 0; iy < amountY; iy++) {
          positions[i]     = ix * separation - (amountX * separation) / 2;
          positions[i + 1] = 0;
          positions[i + 2] = iy * separation - (amountY * separation) / 2;
          scales[j] = 1;
          i += 3;
          j++;
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

      const material = new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(0xffffff) } },
        vertexShader: `
          attribute float scale;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = scale * (300.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }`,
        fragmentShader: `
          uniform vec3 color;
          void main() {
            if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.475) discard;
            gl_FragColor = vec4(color, 1.0);
          }`,
      });

      particles = new THREE.Points(geometry, material);
      scene.add(particles);

      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const onResize = () => {
        halfX = window.innerWidth / 2;
        halfY = window.innerHeight / 2;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      const onMouseMove = (e) => { mouseX = e.clientX - halfX; mouseY = e.clientY - halfY; };
      const onTouchMove = (e) => {
        if (e.touches.length === 1) {
          mouseX = e.touches[0].pageX - halfX;
          mouseY = e.touches[0].pageY - halfY;
        }
      };
      window.addEventListener('resize', onResize);
      document.addEventListener('mousemove', onMouseMove, false);
      document.addEventListener('touchmove', onTouchMove, false);
      document.addEventListener('touchstart', onTouchMove, false);

      const render = () => {
        camera.position.x += (mouseX - camera.position.x + 200) * 0.05;
        camera.position.y += (-mouseY - camera.position.y + 200) * 0.05;
        camera.lookAt(scene.position);

        const pos = particles.geometry.attributes.position.array;
        const sc = particles.geometry.attributes.scale.array;
        let i = 0, j = 0;
        for (let ix = 0; ix < amountX; ix++) {
          for (let iy = 0; iy < amountY; iy++) {
            pos[i + 1] = (Math.sin((ix + count) * 0.3) * 50) +
                         (Math.sin((iy + count) * 0.5) * 50);
            sc[j] = (Math.sin((ix + count) * 0.3) + 1) * 8 +
                    (Math.sin((iy + count) * 0.5) + 1) * 8;
            i += 3;
            j++;
          }
        }
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.scale.needsUpdate = true;
        renderer.render(scene, camera);
        count += 0.05;
      };
      const animate = () => { raf = requestAnimationFrame(animate); render(); };
      animate();

      // cleanup hook
      ParticleWave._cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchstart', onTouchMove);
        renderer && renderer.dispose();
      };
    })();

    return () => {
      mounted = false;
      ParticleWave._cleanup && ParticleWave._cleanup();
    };
  }, [amountX, amountY, separation]);

  return <canvas ref={canvasRef} className="sk-particle-canvas" />;
}

window.ParticleWave = ParticleWave;
