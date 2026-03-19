# Code Snippets: Background Zooming Fix (TASK-442863)

## Updated Scaling Algorithm (Contain)
The high-fidelity Canvas draw loop now uses a 'contain' algorithm instead of 'cover' to prevent the background image from being zoomed in.

```typescript
// From src/App.tsx - Rendering Draw Loop
if (assets?.background) {
  const imgRatio = assets.background.width / assets.background.height;
  const screenRatio = width / height;
  let drawWidth, drawHeight, drawX, drawY;

  if (screenRatio > imgRatio) {
    // Screen is wider than image (letterbox on sides)
    drawHeight = height;
    drawWidth = height * imgRatio;
    drawX = (width - drawWidth) / 2;
    drawY = 0;
  } else {
    // Screen is taller than image (letterbox on top/bottom)
    drawWidth = width;
    drawHeight = width / imgRatio;
    drawX = 0;
    drawY = (height - drawHeight) / 2;
  }

  // Fill background with a dark color for letterboxing
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  
  ctx.drawImage(assets.background, drawX, drawY, drawWidth, drawHeight);
}
```
