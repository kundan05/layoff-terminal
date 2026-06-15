import * as THREE from 'three';
import * as topojson from 'topojson-client';
import { rawLayoffs as layoffData } from './data/layoffs.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const MAX_MARKERS = 2500;
const GLOBE_RADIUS = 1;

function latLngToVector3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

function createArcGeo(startLat, startLng, endLat, endLng, radius) {
    const startVec = latLngToVector3(startLat, startLng, radius);
    const endVec = latLngToVector3(endLat, endLng, radius);
    const distance = startVec.distanceTo(endVec);
    const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);
    const arcHeight = distance * 0.4 + radius + 0.1;
    midPoint.normalize().multiplyScalar(arcHeight);
    const curve = new THREE.QuadraticBezierCurve3(startVec, midPoint, endVec);
    const points = curve.getPoints(Math.max(20, Math.floor(distance * 30)));
    return { geo: new THREE.BufferGeometry().setFromPoints(points), curve };
}

function processGeoJSON(geojson, callback) {
    if (geojson.type === 'FeatureCollection') geojson.features.forEach(f => processGeometry(f.geometry, callback));
    else if (geojson.type === 'Feature') processGeometry(geojson.geometry, callback);
    else processGeometry(geojson, callback);
}

function processGeometry(g, cb) {
    if (!g) return;
    if (g.type === 'Polygon') g.coordinates.forEach(cb);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(cb));
    else if (g.type === 'LineString') cb(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(cb);
}

function renderFilledLand(group, geojson, radius) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x0a1628, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    processGeoJSON(geojson, (coords) => {
        if (coords.length < 4) return;
        try {
            const verts = coords.map(([lng, lat]) => latLngToVector3(lat, lng, radius));
            const geo = new THREE.BufferGeometry().setFromPoints(verts);
            const indices = [];
            for (let i = 1; i < verts.length - 1; i++) { indices.push(0, i, i + 1); }
            geo.setIndex(indices);
            geo.computeVertexNormals();
            group.add(new THREE.Mesh(geo, mat));
        } catch (e) { }
    });
}

function renderCountryBorders(group, geojson, radius) {
    const mat = new THREE.LineBasicMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.3 });
    processGeoJSON(geojson, (coords) => {
        if (coords.length < 3) return;
        const pts = [];
        for (let i = 0; i < coords.length - 1; i++) {
            const [lng1, lat1] = coords[i], [lng2, lat2] = coords[i + 1];
            const dist = Math.sqrt((lng2 - lng1) ** 2 + (lat2 - lat1) ** 2);
            const steps = Math.max(1, Math.ceil(dist));
            for (let s = 0; s < steps; s++) pts.push(latLngToVector3(lat1 + (lat2 - lat1) * (s / steps), lng1 + (lng2 - lng1) * (s / steps), radius));
        }
        pts.push(latLngToVector3(coords[coords.length - 1][1], coords[coords.length - 1][0], radius));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    });
}

export async function createGlobe(container, onMarkerHover, onMarkerClick) {
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.6, 0.3, 0.2);
    bloomPass.threshold = 0.6;
    bloomPass.strength = 0.35;
    bloomPass.radius = 0.3;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const rotationGroup = new THREE.Group();
    scene.add(rotationGroup);

    const globeGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
        color: 0x03080f,
        emissive: 0x010408,
        emissiveIntensity: 0.3,
        specular: 0x112233,
        shininess: 15,
        transparent: true,
        opacity: 0.98,
    });
    rotationGroup.add(new THREE.Mesh(globeGeometry, globeMaterial));

    const graticuleGroup = new THREE.Group();
    const graticuleMat = new THREE.LineBasicMaterial({ color: 0x0f2840, transparent: true, opacity: 0.15 });
    for (let lat = -80; lat <= 80; lat += 20) {
        const p = [];
        for (let lng = -180; lng <= 180; lng += 4) p.push(latLngToVector3(lat, lng, GLOBE_RADIUS + 0.002));
        graticuleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), graticuleMat));
    }
    for (let lng = -180; lng < 180; lng += 20) {
        const p = [];
        for (let lat = -90; lat <= 90; lat += 4) p.push(latLngToVector3(lat, lng, GLOBE_RADIUS + 0.002));
        graticuleGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), graticuleMat));
    }
    rotationGroup.add(graticuleGroup);

    const landGroup = new THREE.Group();
    const countriesGroup = new THREE.Group();
    rotationGroup.add(landGroup);
    rotationGroup.add(countriesGroup);

    try {
        const [countriesTopo, landTopo] = await Promise.all([
            fetch('/countries-topo.json').then(r => r.json()),
            fetch('/world-topo.json').then(r => r.json()),
        ]);
        renderFilledLand(landGroup, topojson.feature(landTopo, landTopo.objects.land), GLOBE_RADIUS + 0.001);
        renderCountryBorders(countriesGroup, topojson.feature(countriesTopo, countriesTopo.objects.countries), GLOBE_RADIUS + 0.003);
    } catch (e) {
        console.warn('Could not load GeoJSON', e);
    }

    const atmosphereMat = new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vNormal; void main() { float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0); gl_FragColor = vec4(0.1, 0.4, 0.6, 1.0) * intensity * 0.15; }`,
        blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 64), atmosphereMat));

    scene.add(new THREE.AmbientLight(0x1a2a3a, 1.2));
    const dirLight = new THREE.DirectionalLight(0x8899bb, 0.6);
    dirLight.position.set(3, 2, 4);
    scene.add(dirLight);

    const starsGeo = new THREE.BufferGeometry();
    const starsPos = new Float32Array(2500 * 3);
    for (let i = 0; i < 7500; i++) starsPos[i] = (Math.random() - 0.5) * 30;
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
    scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0x445566, size: 0.008, transparent: true, opacity: 0.6 })));

    const markerGroup = new THREE.Group();
    rotationGroup.add(markerGroup);

    const topEvents = [...layoffData].sort((a, b) => b.headcount - a.headcount).slice(0, MAX_MARKERS);

    const markers = [];
    const arcPulses = [];
    const markerPositions = [];
    const markerColors = [];
    const markerSizes = [];
    const markerUserData = [];

    topEvents.forEach((event, idx) => {
        const hqPos = latLngToVector3(event.hq.lat, event.hq.lng, GLOBE_RADIUS + 0.005);
        const severity = event.headcount;
        const size = Math.max(0.005, Math.min(0.025, Math.log10(severity) * 0.007));
        const color = severity > 10000 ? 0xcc3344 : severity > 4000 ? 0xcc8833 : 0x33aa77;

        markerPositions.push(hqPos);
        markerColors.push(new THREE.Color(color));
        markerSizes.push(size);
        markerUserData.push({
            city: event.hq.city,
            country: event.hq.country,
            total: severity,
            companies: [{ company: event.company }]
        });

        const spikeHeight = Math.max(0.02, Math.min(0.15, Math.log10(severity) * 0.04));
        const spikeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
        const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.001, size * 0.4, spikeHeight, 6), spikeMat);
        spike.position.copy(latLngToVector3(event.hq.lat, event.hq.lng, GLOBE_RADIUS + 0.005 + spikeHeight / 2));
        spike.lookAt(new THREE.Vector3(0, 0, 0));
        spike.rotateX(Math.PI / 2);
        markerGroup.add(spike);

        const ringGeo = new THREE.RingGeometry(size * 1.2, size * 2.0, 24);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(hqPos);
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        markerGroup.add(ring);

        markers.push({ mesh: null, ring, pulsePhase: Math.random() * Math.PI * 2 });

        if (event.impacts && event.impacts.length > 0) {
            event.impacts.forEach(impact => {
                if (Math.abs(event.hq.lat - impact.lat) < 0.1 && Math.abs(event.hq.lng - impact.lng) < 0.1) return;
                const { geo: arcGeo, curve } = createArcGeo(event.hq.lat, event.hq.lng, impact.lat, impact.lng, GLOBE_RADIUS);
                const arcMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
                markerGroup.add(new THREE.Line(arcGeo, arcMat));

                const pulseGeo = new THREE.SphereGeometry(0.004, 6, 6);
                const pulseMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.5 });
                const pulse = new THREE.Mesh(pulseGeo, pulseMat);
                markerGroup.add(pulse);
                arcPulses.push({ mesh: pulse, curve, progress: Math.random(), speed: 0.001 + Math.random() * 0.001 });

                const tarPos = latLngToVector3(impact.lat, impact.lng, GLOBE_RADIUS + 0.005);
                const tarMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
                const tarMarker = new THREE.Mesh(new THREE.SphereGeometry(0.003, 6, 6), tarMat);
                tarMarker.position.copy(tarPos);
                markerGroup.add(tarMarker);
            });
        }
    });

    const coreGeo = new THREE.SphereGeometry(1, 12, 12);
    const dummy = new THREE.Object3D();
    const coreMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9 });
    const instancedMesh = new THREE.InstancedMesh(coreGeo, coreMat, markerPositions.length);
    markerPositions.forEach((pos, i) => {
        dummy.position.copy(pos);
        const s = markerSizes[i];
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        instancedMesh.setColorAt(i, markerColors[i]);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.instanceColor.needsUpdate = true;
    markerGroup.add(instancedMesh);

    // ── Mouse Interaction ──────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false, dragDistance = 0, autoRotate = true;
    let targetRotX = 0, targetRotY = 0, previousMouse = { x: 0, y: 0 };
    let hoveredInstance = -1;

    renderer.domElement.addEventListener('mousedown', (e) => {
        isDragging = true; dragDistance = 0; autoRotate = false;
        previousMouse = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('mousemove', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        if (isDragging) {
            const dx = e.clientX - previousMouse.x;
            const dy = e.clientY - previousMouse.y;
            dragDistance += Math.abs(dx) + Math.abs(dy);
            targetRotY += dx * 0.006;
            targetRotX += dy * 0.004;
            targetRotX = Math.max(-0.5, Math.min(0.5, targetRotX));
            previousMouse = { x: e.clientX, y: e.clientY };
        }

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(instancedMesh);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
            const idx = intersects[0].instanceId;
            if (idx !== hoveredInstance) {
                hoveredInstance = idx;
                container.style.cursor = 'pointer';
                if (onMarkerHover) onMarkerHover(markerUserData[idx], e);
            }
        } else if (hoveredInstance >= 0) {
            hoveredInstance = -1;
            container.style.cursor = 'grab';
            if (onMarkerHover) onMarkerHover(null, e);
        }
    });
    renderer.domElement.addEventListener('mouseup', () => { isDragging = false; setTimeout(() => autoRotate = true, 2000); });
    renderer.domElement.addEventListener('click', () => {
        if (dragDistance > 8) return;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(instancedMesh);
        if (intersects.length > 0 && intersects[0].instanceId !== undefined && onMarkerClick) {
            onMarkerClick(markerUserData[intersects[0].instanceId]);
        }
    });
    renderer.domElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoom = camera.position.z - e.deltaY * 0.003;
        camera.position.z = Math.max(1.3, Math.min(6, zoom));
    }, { passive: false });

    // ── Animation Loop ─────────────────────────────────────
    let time = 0;
    function animate() {
        requestAnimationFrame(animate);
        time += 0.016;

        if (autoRotate) rotationGroup.rotation.y += 0.0015;

        rotationGroup.rotation.y += targetRotY;
        rotationGroup.rotation.x += targetRotX;
        rotationGroup.rotation.x = Math.max(-1.2, Math.min(1.2, rotationGroup.rotation.x));
        targetRotX *= 0.9;
        targetRotY *= 0.9;

        markers.forEach(m => {
            const p = Math.sin(time * 2.0 + m.pulsePhase) * 0.5 + 0.5;
            m.ring.material.opacity = 0.08 + 0.15 * p;
            m.ring.scale.setScalar(1 + p * 0.3);
        });

        arcPulses.forEach(pulse => {
            pulse.progress += pulse.speed;
            if (pulse.progress > 1) pulse.progress = 0;
            const pos = pulse.curve.getPoint(pulse.progress);
            pulse.mesh.position.copy(pos);
            let fade = 1.0;
            if (pulse.progress < 0.1) fade = pulse.progress / 0.1;
            if (pulse.progress > 0.9) fade = (1.0 - pulse.progress) / 0.1;
            pulse.mesh.material.opacity = fade * 0.5;
        });

        composer.render();
    }
    animate();

    function onResize() {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return { scene, camera, renderer, composer, onResize };
}
