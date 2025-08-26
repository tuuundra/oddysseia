# Camera Positions Reference

## Original Camera Position
From Scene.tsx (line 594):
```
[32.19, -1.37, -31.22]
```
This camera position was looking toward (0, 0, 0)

## Current Scrollytelling Camera Position
From SceneContainer.jsx:
```
[0, 5, 20]
```
With animation parameters (SimpleScrollyControls.jsx):
- Right movement: initial.x + offset * 8
- Down movement: initial.y - offset * 3
- Backward movement: initial.z + offset * 15
- Look direction: left (-5), down (-2), forward (-5)

## Other Camera Positions To Try
- `[15, 3, 15]` - 3/4 view looking toward center 
- `[20, 0, 0]` - side view
- `[0, 10, 30]` - higher perspective 