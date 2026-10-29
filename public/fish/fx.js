// Hiệu ứng: nước bắn tung toé, lấp lánh khi bắt được cá hiếm
import * as THREE from 'three';

export class Particles {
  constructor(scene, { max = 1500, additive = false, gravity = 9.8, ratio = 1 } = {}) {
    this.max = max;
    this.gravity = gravity;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.next = 0;
    this.water = null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uRatio: { value: ratio } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; uniform float uRatio;
        varying float vA; varying vec3 vC;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv; gl_PointSize = size * 300.0 * uRatio / -mv.z; }`,
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.15, d) * vA; gl_FragColor = vec4(vC, a); }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p, v, color, size, life) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size;
    this.life[i] = life;
    this.age[i] = 0;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = i * 3;
      this.vel[k + 1] -= this.gravity * dt;
      const drag = 1 - dt * 0.6;
      this.vel[k] *= drag;
      this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.water && this.pos[k + 1] < 0 && this.vel[k + 1] < 0) this.age[i] = this.life[i];
      const t = this.age[i] / this.life[i];
      this.alpha[i] = Math.min(1, (1 - t) * 1.6);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
const v = new THREE.Vector3();
const p = new THREE.Vector3();

export class Effects {
  constructor(scene, ratio) {
    this.splash = new Particles(scene, { max: 1600, ratio });
    this.splash.water = true;
    this.sparkle = new Particles(scene, { max: 900, additive: true, gravity: -0.6, ratio });
  }

  // nước bắn: size là độ lớn cú bắn (0.3 phao rơi .. 3 cá khủng quẫy)
  splashAt(at, size = 1, tint = WHITE) {
    const n = Math.floor(18 + size * 40);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const out = (0.3 + Math.random()) * (0.6 + size * 0.5);
      v.set(Math.cos(a) * out, (1.5 + Math.random() * 2.5) * (0.6 + size * 0.45), Math.sin(a) * out);
      p.set(at.x + Math.cos(a) * 0.05 * size, 0.02, at.z + Math.sin(a) * 0.05 * size);
      const c = tint.clone().lerp(WHITE, 0.6 + Math.random() * 0.4);
      this.splash.emit(p, v, c, 0.02 + Math.random() * 0.035 * (0.6 + size * 0.4), 0.6 + Math.random() * 0.6);
    }
  }

  // lấp lánh quanh một điểm, màu theo độ hiếm
  burst(at, color, n = 80, spread = 1) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      v.set((Math.random() - 0.5) * 2, (Math.random() - 0.3) * 2, (Math.random() - 0.5) * 2).normalize().multiplyScalar(spread * (0.4 + Math.random()));
      this.sparkle.emit(at, v, c.clone().multiplyScalar(1.5 + Math.random() * 2), 0.015 + Math.random() * 0.03, 0.8 + Math.random() * 1.2);
    }
  }

  update(dt) {
    this.splash.update(dt);
    this.sparkle.update(dt);
  }
}
