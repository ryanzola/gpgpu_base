varying vec2 vUv;
varying vec3 vPosition;

uniform sampler2D uPositions;

attribute vec2 reference;

float PI = 3.1415926535897932384626433832795;

void main(){
  vUv = uv;
  vPosition = position;

  vec3 pos = texture2D(uPositions, reference).xyz;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = 25.0 * (1.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}