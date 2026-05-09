# Texture Tool

The goal of this tool is to generate textures that can be colored dynamically via a gradient and contain normal maps in 1 texture.

```bash
npm install
npm run dev
```

- Load a base color texture and a normal map
- Optionally clamp darkness and lightness to allow the mid-range to expand wider for normalization
- The result is a normalized grayscale texture
- The Packed texture contains both the normal and the grayscale texture, which is stored in the alpha channel, save that texture
- In your runtime, read the normal from RGB channels, and map the alpha channel to a color gradient of your choice
- Profit

https://github.com/user-attachments/assets/8694117a-5e21-479a-99fe-17198e0be3a6

Join the [Web Game Dev Discord](https://webgamedev.com/discord) to [discuss it](https://discord.com/channels/1032873609280106566/1492817891588964502).
