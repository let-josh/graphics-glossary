import { DEG2RAD } from "three/src/math/MathUtils.js";
import {
	Fn,
	If,
	rotate,
	screenCoordinate,
	screenSize,
	texture,
	vec3,
	vec4,
} from "three/tsl";
import type { Node, Texture, TextureNode } from "three/webgpu";
import { Vector4 } from "three/webgpu";

type FloatOrNumber = Node<"float"> | number;

const rgb2cmyk = /*@__PURE__*/ Fn(
	([rgb]: [rgb: Node<"vec3">]): Node<"vec4"> => {
		const oneMinusRgb = rgb.oneMinus();
		const k = oneMinusRgb.r.min(oneMinusRgb.g).min(oneMinusRgb.b);
		const cmy = vec3();

		If(k.toBool(), () => {
			cmy.assign(oneMinusRgb.sub(k).div(k.oneMinus()));
		});

		return vec4(cmy, k);
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
	]: [tex: Texture | TextureNode, options?: Partial<Options>]) => {
		const gridUv = Fn(([angle]: [angle: Node<"float">]): Node<"vec2"> => {
			return rotate(screenCoordinate, angle).div(size);
		});

		const cellCenterUv = Fn(
			([gridUv, angle]: [
				gridUv: Node<"vec2">,
				angle: Node<"float">,
			]): Node<"vec2"> => {
				const cellCenter = gridUv.floor().add(0.5);
				return rotate(cellCenter, angle).mul(size).div(screenSize);
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
