import { DEG2RAD } from "three/src/math/MathUtils.js";
import {
	Fn,
	If,
	min,
	rotate,
	screenSize,
	screenUV,
	texture,
	vec3,
	vec4,
} from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { Vector4 } from "three/webgpu";

type FloatOrNumber = Node<"float"> | number;

const rgb2cmyk = /*@__PURE__*/ Fn(
	([rgb]: [rgb: Node<"vec3">]): Node<"vec4"> => {
		const oneMinusRgb = rgb.oneMinus();
		const k = min(oneMinusRgb.r, oneMinusRgb.g, oneMinusRgb.b);
		const cmy = vec3();

		const oneMinusK = k.oneMinus();

		If(oneMinusK.toBool(), () => {
			cmy.assign(oneMinusRgb.sub(k).div(oneMinusK));
		});

		return vec4(cmy, k).clamp();
	},
);

type Options = {
	angles: Node<"vec4"> | Vector4;
	strengths: Node<"vec4"> | Vector4;
	spacing: FloatOrNumber;
	size: FloatOrNumber;
};

export const halftone = /*@__PURE__*/ Fn(
	([
		tex,
		{
			angles = new Vector4(15, 45, 0, 75).multiplyScalar(DEG2RAD),
			strengths = new Vector4(1, 1, 1, 1),
			spacing = 0.5,
			size = 8,
		} = {},
	]: [tex: TextureNode, options?: Partial<Options>]) => {
		const gridUv = Fn(([radians]: [radians: Node<"float">]): Node<"vec2"> => {
			return rotate(screenUV.mul(screenSize), radians).div(size);
		});

		const cellCenterUv = Fn(
			([gridUv, radians]: [
				gridUv: Node<"vec2">,
				radians: Node<"float">,
			]): Node<"vec2"> => {
				const cellCenter = gridUv.floor().add(0.5);
				return rotate(cellCenter, radians).mul(size).div(screenSize);
			},
		);

		const halftoneDot = Fn(
			([gridUv, coverage]: [
				gridUv: Node<"vec2">,
				coverage: Node<"float">,
			]): Node<"float"> => {
				return gridUv
					.fract()
					.sub(0.5)
					.length()
					.step(coverage.clamp().sqrt().mul(spacing))
					.oneMinus();
			},
		);

		const gridUvC = gridUv(angles.x);
		const gridUvM = gridUv(angles.y);
		const gridUvY = gridUv(angles.z);
		const gridUvK = gridUv(angles.w);

		const negatedAngles = angles.negate();

		const uvC = cellCenterUv(gridUvC, negatedAngles.x);
		const uvM = cellCenterUv(gridUvM, negatedAngles.y);
		const uvY = cellCenterUv(gridUvY, negatedAngles.z);
		const uvK = cellCenterUv(gridUvK, negatedAngles.w);

		const cmykC = rgb2cmyk(texture(tex, uvC).rgb);
		const cmykM = rgb2cmyk(texture(tex, uvM).rgb);
		const cmykY = rgb2cmyk(texture(tex, uvY).rgb);
		const cmykK = rgb2cmyk(texture(tex, uvK).rgb);

		const dotC = halftoneDot(gridUvC, cmykC.x);
		const dotM = halftoneDot(gridUvM, cmykM.y);
		const dotY = halftoneDot(gridUvY, cmykY.z);
		const dotK = halftoneDot(gridUvK, cmykK.w);

		const color = vec3(dotC, dotM, dotY)
			.mul(vec3(strengths.x, strengths.y, strengths.z))
			.oneMinus();

		return vec4(color.mul(dotK.mul(strengths.w).oneMinus()), 1.0);
	},
);
