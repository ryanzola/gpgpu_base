import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

import vertex from './shader/vertexParticles.glsl';
import fragment from './shader/fragment.glsl';
import fragmentShaderPosition from './shader/fragmentPosition.glsl';
import fragmentShaderVelocity from './shader/fragmentVelocity.glsl';

// 32 sqared will be the number of particles
const COUNT = 32;
const TEXTURE_WIDTH = COUNT**2;


export default class Sketch {
  constructor(options) {
    this.container = options.dom;
    this.scene = new THREE.Scene();

    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xEEEEEE, 1);
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);
    this.camera.position.z = 1;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;


    this.mouse = { x: 0, y: 0 };
    this.time = 0;

    this.setupResize();
    this.resize();
    this.mouseEvents();
    this.addObjects();
    this.initGPU();
    this.render()
  }

  setupResize() {
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  mouseEvents() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX - window.innerWidth / 2);
      this.mouse.y = (e.clientY - window.innerHeight / 2);
    });
  }


  addObjects() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector4() },
        uPositions: { value: null },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
    })

    this.geometry = new THREE.BufferGeometry();
    let count = TEXTURE_WIDTH;
    let positions = new Float32Array(count * 3);
    let reference = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 5 * (Math.random() - 0.5);
      positions[i * 3 + 1] = 5 * (Math.random() - 0.5);
      positions[i * 3 + 2] = 0;

      reference[i * 2] = (i % COUNT) / COUNT;
      reference[i * 2 + 1] = ~ ~ (i / COUNT) / COUNT;
    }

    let positionAttribute = new THREE.BufferAttribute(positions, 3);
    this.geometry.setAttribute('position', positionAttribute);

    let referenceAttribute = new THREE.BufferAttribute(reference, 2);
    this.geometry.setAttribute('reference', referenceAttribute);

    this.plane = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.plane);
  }

  fillPositionTexture(texture) {
    let theArray = texture.image.data;

    for (let k = 0, kl = theArray.length; k < kl; k += 4) {
      theArray[k + 0] = 2 * (Math.random() - 0.5);
      theArray[k + 1] = 2 * (Math.random() - 0.5);
      theArray[k + 2] = 0;
      theArray[k + 3] = 1;
    }
  }

  fillVelocityTexture(texture) {
    let theArray = texture.image.data;

    for (let k = 0, kl = theArray.length; k < kl; k += 4) {
      theArray[k + 0] = 0.001 * (Math.random() - 0.5);
      theArray[k + 1] = 0.001 * (Math.random() - 0.5);
      theArray[k + 2] = 0;
      theArray[k + 3] = 1;
    }
  }

  initGPU() {
    this.gpuCompute = new GPUComputationRenderer(TEXTURE_WIDTH, TEXTURE_WIDTH, this.renderer);

    const dtPosition = this.gpuCompute.createTexture();
    const dtVelocity = this.gpuCompute.createTexture();
    this.fillPositionTexture(dtPosition);
    this.fillVelocityTexture(dtVelocity);

    this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', fragmentShaderVelocity, dtVelocity);
    this.positionVariable = this.gpuCompute.addVariable('texturePosition', fragmentShaderPosition, dtPosition);

    this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
    this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);

    this.positionUniforms = this.positionVariable.material.uniforms;
    this.velocityUniforms = this.velocityVariable.material.uniforms;

    this.positionUniforms.time = { value: 0.0 };
    this.velocityUniforms.time = { value: 0.0 };

    this.velocityVariable.wrapS = THREE.RepeatWrapping;
    this.velocityVariable.wrapT = THREE.RepeatWrapping;
    this.positionVariable.wrapS = THREE.RepeatWrapping;
    this.positionVariable.wrapT = THREE.RepeatWrapping;

    this.gpuCompute.init();
  }

  render() {
    this.time += 0.05;
    this.positionUniforms['time'].value = this.time;
    this.velocityUniforms['time'].value = this.time;

    this.gpuCompute.compute();

    this.material.uniforms.uPositions.value = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
    
    this.controls.update();
    window.requestAnimationFrame(this.render.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}

new Sketch({ dom: document.getElementById('container') });