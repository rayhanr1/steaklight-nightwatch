# Steaklight Nightwatch

I want to build a 2D web game inspired by minecraft. At the beginning, there will a prompt to start new game with input boxes to control the following with sliders: Speed of enemies of how fast enemies move around, time of starting day cycle in seconds, and time of starting night cycle in seconds. The background is a video of the minecraft forest biome that changes from day to night. The day cycle default is 30 seconds and during it, small pixelated steaks will float through the screen randomly similar to the ball movement in pong, they can go off screen and disappear as well. User will control the Steve character using arrow keys to move around and collect the steaks. Each steak will give half a heart, added to the Life meter in the top left that displays total hearts. Once the 30 seconds to collect food is over, the background should be changed to the night biome and now there will be the night cycle for 1 minute where skeletons and creepers floating around the screen. The movement of these objects will be like pong, randomly flying around but at a slow speed. The enemies will bounce on 2 of the 4 edges of the screen with pong physics, and then will go off screen instead of bouncing the 3rd time. The object is to avoid the enemies because if you get into contact with a skeleton, it's -.5 hearts and the skeleton disappears and if you get into contact with a creeper, it's -1 heart and the creeper explodes. If you survive the night cycle, that is the end of the level and it will display Level # complete. If you lose all your hearts, it will say GAME OVER and you will be prompted to start a new game. Every level, the time of night cycle will incrementally get slightly longer and the enemies will incrementally spawn more

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/70ba1261-5092-477c-bf82-0bb89f48342c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
