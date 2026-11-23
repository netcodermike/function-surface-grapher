# Function and Surface Grapher

Plot functions of one variable in 2D and rotate surfaces of two variables in 3D with adjustable domains.

![Running demo](docs/demo.webp)

[Open the browser app](https://surfingcoder.com/apps/function-surface-grapher/)

## Run locally

Run the following command in this repository and open [localhost:8000](http://localhost:8000).

    python -m http.server 8000

Choose a curve or surface example, then enter an expression and set plot bounds. Curves treat y bounds as the visible value range. Surfaces treat y bounds as an input range and scale z to the finite sampled values.

Write explicit multiplication, such as 2*x, and use ^ for powers. Allowed functions are sin, cos, tan, sqrt, abs, exp, log, log10, asin, acos and atan. Trigonometric inputs are radians. The constants pi and e are available. The parser accepts only this mathematical grammar.

Use the zoom buttons or drag the curve to pan. Drag a surface to rotate it or use the rotation buttons. Undefined values leave gaps. Uniform sampling can miss narrow features, so tighten the bounds for detail.

## Verify

Run the following command with Node.js 22 or newer.

    node --test
