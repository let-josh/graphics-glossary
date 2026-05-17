import {
	Discard,
	Fn,
	If,
	length,
	screenSize,
	step,
	texture,
	uv,
	vec2,
} from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";

type FloatOrNumber = Node<"float"> | number;

type Options = {
	radius: FloatOrNumber;
	size: FloatOrNumber;
};

export const halftone = /*@__PURE__*/ Fn(
	([tex, { radius = 0.5, size = 16 } = {}]: [
		tex: TextureNode,
		options?: Partial<Options>,
	]) => {
		const n = vec2(size, size).div(screenSize);

		const zeroOrOne = uv().y.div(n.y).floor().mod(2);
		const offset = vec2(n.x.mul(0.5).mul(zeroOrOne), 0);

		const offsetUv = uv().add(offset);

		const cellUv = offsetUv.div(n).fract();
		const dist = length(cellUv.sub(0.5));
		const circle = step(radius, dist);

		If(circle, () => {
			Discard();
		});

		const UV = offsetUv.div(n).floor().mul(n);

		return texture(tex, UV);
	},
);
