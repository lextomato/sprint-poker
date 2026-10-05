# Team Room assets

## Active office environment

`modern-office/office-composition.webp` is the furnished office composition
created for Sprint Poker using **Modern Office 2D Props Pack v1.0** by nacl1234.

- Source: https://nacl1234.itch.io/top-down-modern-office-2d-asset-pack
- Copyright (c) 2026 nacl1234. Commercial interactive-project use permitted.
- The downloaded v1.0 archive contains 54 props (not 68 as advertised).
- The original ZIP, individual PNGs and original atlases are not redistributed.
- This composed artwork is embedded in the application, not offered as an asset
  pack. Its underlying artwork must not be extracted or redistributed separately.
- Full license: `docs/licenses/modern-office.txt` in the repository.
- Rebuild: `node scripts/build-office-scene.mjs <extracted-kit-directory>`.
  The generated scene and layout are checked in; normal builds do not require
  access to the source kit. Pizarras are custom artwork composed by this script.

## Avatars and previous environment

The 2D character and environment sprites in this directory are adapted from
Kenney's **Top-down Shooter** asset pack.

- Source: https://kenney.nl/assets/top-down-shooter
- License: Creative Commons CC0 1.0
- License text: https://creativecommons.org/publicdomain/zero/1.0/

The original files were renamed and a focused subset was included for the
Virtual Team Room.

The face-visible avatars and perspective furniture are adapted from Kenney's
**Roguelike Characters** and **Roguelike/RPG** packs.

- Sources: https://kenney.nl/assets/roguelike-characters and https://kenney.nl/assets/roguelike-rpg-pack
- License: Creative Commons CC0 1.0

## Directional avatars

`avatars-directional/` contains four original generated character designs used
in the Virtual Team Room. Each character has eight transparent, static facing
views; these are selected from the movement direction, with no walk-cycle
animation. These generated assets are integrated into the selectable avatar
set and used by the Virtual Team Room.

## Isometric office shell

`architecture/office-shell.png` is an original generated architectural
background: floors, open-front walls, windows and daylight only. Furnishings are
still composited from `modern-office/office-composition.webp`, built from the
licensed Modern Office 2D Props Pack described above.
