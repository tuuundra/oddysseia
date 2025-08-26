## Odysseia — Intro Scene (mouse‑reactive rock)

A small, focused demo scene showcasing a physically‑based rock model that reacts to mouse movement and hover state inside a winter landscape.

![Intro scene screenshot](/Screenshot%202025-08-26%20at%202.17.32%E2%80%AFPM.png)

### Features
- Mouse‑reactive rock using `@react-three/fiber` pointer events
- High‑quality PBR materials and environment lighting (`drei` `Environment`)
- Subtle post‑processing and snow particle effects
- Clean separation of scene objects and effects

### Tech stack
- Next.js 15, React 19
- Three.js via `@react-three/fiber` and `@react-three/drei`
- Typescript

### Run locally
```bash
npm ci && npm run dev
# open http://localhost:3000
```

### Notes
- The previous "click to explore" overlay is disabled by default. Re‑enable by passing `enabled={true}` to `FloatingText` in `components/Scene.tsx`.
- Assets used in this scene live under `public/`.
- The fractured rock mesh was authored in Unreal Engine 5 using the Fracture tool, then exported for use with Three.js.
