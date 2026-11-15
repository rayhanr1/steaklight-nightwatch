# minecraft-2d-scroller

**Minecraft Survive the Night** is a 2D Minecraft-inspired survival game for the browser.

**Play it live: https://minecraft-2d-scroller.lovable.app**

## How to play

- **Day:** move Steve with the arrow keys / WASD (or tap and hold) to grab floating steaks (+½ heart each) and blocks (wood, then stone from level 2, iron from level 3).
- **Night (20s by default):** survive skeletons (shoot arrows), creepers (chase you and explode), zombies (level 2+) and spiders (level 3+).
  - **Space** swings your sword.
  - **Z / X / C** place wood / stone / iron right where Steve stands. Wood takes 2 hits, stone 4, iron 6. Surviving blocks persist into the next day and repel mobs. **V** places TNT (level 5+), which only explodes when hit by a mob, arrow, sword, or explosion, without directly hurting Steve.
  - Creeper explosions also destroy nearby mobs.
- **Esc** pauses; while paused you can resume, save progress (signed in) or quit.
- Score: 100 per level cleared, 10 per mob defeated, 5 per steak. Your high score is saved.

Start-menu defaults: enemy speed 5 (the former speed 6), day 5s, night 20s.
Days grow by 1s per level up to 20s. Life is capped at 16 hearts in two rows of eight; at full health new steaks are replaced by extra blocks. Enemies speed up each level until level 10. Steve gains speed every three levels (4, 7, 10, and so on).

This project was built with [Lovable](https://lovable.dev).
