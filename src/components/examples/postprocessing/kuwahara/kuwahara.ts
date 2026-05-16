import {
	Fn,
	Loop,
	float,
	luminance,
	screenCoordinate,
	screenSize,
	texture,
	uint,
	vec2,
	vec3,
	vec4,
} from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";

type Options = {
	kernelSize: number;
	offset: Node<"vec2">;
};

export const sample = /*@__PURE__*/ Fn(
	([tex, options = {}]: [TextureNode, Partial<Options>]): Node<"vec4"> => {
		const kernelSize = options.kernelSize ?? 5;
		const offset = options.offset ?? vec2(0, 0);
		const luminanceSum = float(0);
		const luminanceSum2 = float(0);
		const colorSum = vec3(0);
		const count = uint(0);
		Loop(kernelSize, ({ i: y }) => {
			Loop(kernelSize, ({ i: x }) => {
				const xy = vec2(x, y).add(offset);
				const sample = texture(
					tex,
					screenCoordinate.add(xy).div(screenSize),
				).rgb;
				const lum = luminance(sample);
				luminanceSum.addAssign(lum);
				luminanceSum2.addAssign(lum.mul(lum));
				colorSum.addAssign(sample);
				count.addAssign(1);
			});
		});

		const mean = luminanceSum.div(count);
		const std = luminanceSum2.div(count.sub(mean.mul(mean)));

		return vec4(colorSum.div(count), std);
	},
);
