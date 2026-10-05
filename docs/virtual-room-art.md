# Virtual Room artwork

## Office environment

The active scene uses nacl1234's Modern Office 2D Props Pack v1.0:
https://nacl1234.itch.io/top-down-modern-office-2d-asset-pack

The pack uses an elevated three-quarter view, soft dark outlines, muted teal
upholstery, warm wooden surfaces, and restrained shading. It is not strict
isometric art. Keep new artwork aligned with that perspective.

The source ZIP contains 54 pieces and no avatars, floors, walls or boards.
The office is composed at 2x display resolution by `scripts/build-office-scene.mjs`.
Only the composed application artwork and its placement data are checked in.
Standalone source PNGs and original atlases must stay outside the repository.
See `docs/licenses/modern-office.txt` for the original terms.

To regenerate, install workspace dependencies, download/extract the licensed kit
outside this repository, then run:

```powershell
node scripts/build-office-scene.mjs "C:/path/to/ModernOffice2DProps_v1.0"
```

Normal web and Docker builds consume the generated WebP and JSON directly.
No download, account or source kit is required at build time.

`node scripts/check-office-layout.mjs` checks that every gadget can be reached
from the workspace with the current walls and furniture footprints. The scene
compiler also rejects clipped props, overlapping frames and out-of-bounds art.

## Next phase: avatars

Recommended: Scenario for reference-driven characters, multi-direction sheets
and animation workflows. Recraft is an alternative for character design and
visual exploration, with animation requiring a separate step.

- https://help.scenario.com/articles/2974691727-scenario-apps-for-gaming
- https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario
- https://www.recraft.ai/docs/best-practices/character-consistency

Start with one approved character, then create a small diverse cast. Request:

- Full body, elevated three-quarter camera, visible face, no pixel art.
- Soft charcoal outlines, teal/coral/mustard accents, simple office clothing.
- Flat cartoon shading, consistent upper-left lighting, no baked floor/shadow.
- Transparent background; identical cell sizes and bottom-center foot anchors.
- Four directional idle poses, then 6-8 walk frames per direction.
- A readable silhouette at 48-64 CSS pixels tall and exports at least 2x larger.

Suggested initial prompt:

> Full-body friendly office coworker, elevated three-quarter 2D game view with
> visible face, hand-illustrated flat cartoon, clean soft charcoal outlines,
> muted teal jacket and coral accent, natural proportions with a slightly larger
> head, simple two-tone shading, soft upper-left light, neutral idle pose, feet
> fully visible, centered bottom foot anchor, transparent background, no floor,
> no shadow, no text, no pixel art, no photorealism.

Review every direction and walk cycle for consistent identity, clothing,
scale, foot placement and looping before replacing the current avatar set.
AI output is an art source, not automatically an engine-ready animation.
