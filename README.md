# Evolving Realms  
**Assignment 3 – MVP Implementation**

Evolving Realms is a real-time procedural world prototype built using Three.js. This project demonstrates the core graphics pillars required for Assignment 3, including procedural terrain generation, dynamic lighting, shader-based water, instanced vegetation animation, and interactive meteor impacts that permanently modify the environment.

The purpose of this MVP is to prove the technical feasibility of the world simulation and its core rendering and animation systems.

---

# Overview

Evolving Realms generates a fully interactive 3D world at runtime. The terrain is created using layered noise and domain warping, with additional features such as a carved river and a procedural mountain. The environment includes animated water, trees that sway and react to shockwaves, and a full day/night cycle driven by physically-inspired lighting.

Users can trigger meteor strikes that deform the terrain, spawn debris, and generate propagating shockwaves that affect nearby vegetation.

This prototype focuses on real-time procedural generation, shader-based rendering, and dynamic world interaction.

---

# Core Graphics Features

## Procedural Terrain Generation

- Terrain generated using multi-octave fractal noise (FBM)
- Domain warping for natural terrain variation
- Procedural river carved along a spline path
- Procedural mountain stamping
- Persistent terrain deformation using crater stamping

Terrain is generated entirely at runtime without external models.

---

## Shader-Based Water Rendering

Custom GLSL shaders simulate water surface motion and appearance.

Features include:

- Continuous animated ripples
- Depth-based color blending
- Shoreline foam effect
- Specular highlights that change with sun and moon direction

---

## Instanced Vegetation System

Trees are rendered using instanced meshes for performance efficiency.

Features:

- Procedural placement across terrain
- Continuous sway animation
- Shockwave-based bending when meteors impact

Instancing allows thousands of trees to render efficiently.

---

## Dynamic Day and Night Cycle

The environment simulates a continuous day/night cycle.

Features:

- Moving sun and moon directional lights
- Changing ambient light intensity
- Dynamic fog adjustment
- Sky shader with stars visible at night
- Lighting color shifts during sunrise and sunset

This system affects terrain, water, and environment shading.

---

## Meteor Impact System

Users can trigger meteor strikes interactively.

Each meteor:

- Falls from the sky
- Creates a crater in the terrain
- Spawns debris particles
- Generates a propagating shockwave
- Causes nearby trees to bend

Terrain deformation is permanent and accumulative.

---

# Controls

| Key / Input | Action |
|------------|--------|
| Meteor Button | Trigger random meteor strike |
| Space | Trigger random meteor strike |
| R | Reset terrain and score |
| Mouse Drag | Rotate camera |
| Scroll Wheel | Zoom |
| Right Mouse Drag | Pan camera |

---

# Technical Stack

- Three.js (WebGL rendering)
- GLSL shaders
- JavaScript (ES Modules)
- Vite (development server)
- Node.js

---

# Build Instructions

Follow these steps to run the project.

---

## npm install
## npm run dev

