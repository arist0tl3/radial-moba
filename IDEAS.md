# Ideas & Next Steps

## Gameplay Feel (high priority)

- **Fog of war**: Players should only see entities within their team's vision radius. Bots currently "see" the whole map — fog would level the playing field and add strategic depth (scouting, flanking, surprise attacks).
- **One active ability**: A single skillshot or AOE per hero. Makes positioning and timing matter — biggest differentiator between player and bot.
- **HP tuning pass**: Balance player HP, minion HP, structure HP, and damage values across the board now that leveling exists. Currently untested at scale.

## Visual Polish

- **Sound effects**: Attack impacts, level-up chime, structure destruction, minion death. Need to get physics/gameplay solid first.
- **Particles**: Base under attack shake/particles, level-up sparkle effect, structure destruction debris.

## Structural / Tech

- **Client-side prediction**: Reduce perceived input lag for local player movement.
- **Colyseus schema codegen**: Replace `any` types in client state listeners with proper typed schemas.
- **Server-side validation**: Bounds checking, speed hack prevention on move targets.
