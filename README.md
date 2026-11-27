# Function and Surface Grapher

Plot up to four equations together. Compare 2D curves or rotate color-shaded 3D surfaces on shared numeric axes. Inspect coordinates, pin a point, or highlight intersections to see where the equations have the same value. The browser app and the Electron desktop edition share a JavaScript math parser and HTML Canvas renderer.

![Running demo](docs/demo.webp)

[Open the browser app](https://surfingcoder.com/apps/function-surface-grapher/)

## Desktop edition

The offline desktop edition runs from a local Electron window. [Download the Windows x64 ZIP](https://github.com/netcodermike/function-surface-grapher/releases/download/v1.1.1/FunctionAndSurfaceGrapher-win-x64.zip), extract it, and open `FunctionAndSurfaceGrapher.exe`. Keep the executable and its bundled files together.

To run the desktop edition from source with Node.js 22.12 or newer and npm:

    npm ci
    npm start

Rebuild the portable Windows x64 ZIP with Python 3.10 or newer:

    python scripts/package-windows.py --output-dir dist

## Run locally

Run the following command in this repository and open [localhost:8000](http://localhost:8000).

    python -m http.server 8000

Choose a curve or surface example, or enter your own expressions. Use **Add expression** to add a series, then select **Plot expressions** to apply edits. Curves use the y bounds as the visible output range. Surfaces use the y bounds as an input range and share one z scale based on the finite, drawable samples.

Write explicit multiplication, such as `2*x`, and use `^` for powers. You can optionally start with `y =` for a curve or `z =` for a surface. Supported functions include `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `cbrt`, `abs`, `exp`, `log`, `ln`, and `log10`. Trigonometric inputs are radians. The constants `pi` and `e` are available.

Use **Fit each axis** to fill the graph or **Equal units** to preserve the relative scale of lengths. Drag or use the arrow keys to pan 2D plots or rotate 3D plots. Zoom changes the plotted bounds. Reset view restores the last submitted bounds and the initial angle.

Hover to read coordinates. In 2D, the inspector evaluates the nearest curve at the horizontal cursor position. In 3D, it reads x and y from the visible mesh and evaluates the selected equation there. Click or tap to pin a reading. With the graph focused, use **Shift + arrows** to move a probe, **Enter** or **Space** to toggle a pin, and **Escape** to clear it. Invalid edits keep the last successful graph visible.

## Intersection solutions

Gold markers show numerical solutions where two 2D curves have the same y value. In 3D, gold traces and isolated points show where the sampled meshes share the same z value for the same x and y. Select a marker, trace, or listed point to read its coordinates. Coincident expressions can share an entire region.

The grapher uses finite sampling and probes for gaps. Narrow or highly oscillatory features can fall between samples, and 3D intersection coordinates are estimates from the displayed mesh. Narrow the bounds for a closer look.

## Verify

Run the following command with Node.js 22 or newer.

    node --test
