Vendored copy of the anatomy skill's kit (MIT, see LICENSE): the isometric SVG kit, its 3D
"turning groups" mode and the geometry audits. `scripts/biplano/` builds its figure with it.

Local change: `kit/turn-audit.mjs` measures each part's reach in the continuity check as the
distance from the hinge's own axis (upstream uses the distance from a vertical axis, which
under-reads parts high above a horizontal hinge and flags their motion as a jump).
