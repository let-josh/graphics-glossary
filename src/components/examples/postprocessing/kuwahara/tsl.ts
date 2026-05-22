import {
	Fn,
	If,
	Loop,
	float,
	int,
	luminance,
	screenCoordinate,
	screenSize,
	texture,
	uint,
	vec2,
	vec3,
	vec4,
} from "three/tsl";
import type { Node, Texture, TextureNode } from "three/webgpu";

type SampleOptions = {
	/** size of each sector/region in pixels */
	size: Node<"int"> | number;
	/** xy- offset to apply to the sector/region */
	offset: Node<"vec2">;
};

const sample = /*@__PURE__*/ Fn(
	([tex, { offset = vec2(0, 0), size = int(5) } = {}]: [
		tex: Texture | TextureNode,
		options?: Partial<SampleOptions>,
	]): Node<"vec4"> => {
		const luminanceSum = float(0);
		const luminanceSum2 = float(0);
		const colorSum = vec3(0);
		const count = uint(0);

		Loop(
			{
				start: int(0),
				end: size,
				type: "int",
				condition: "<",
			},
			({ i: y }) => {
				Loop(
					{
						start: int(0),
						end: size,
						type: "int",
						condition: "<",
					},
					({ i: x }) => {
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
					},
				);
			},
		);

		const mean = luminanceSum.div(count);
		const std = luminanceSum2.div(count.sub(mean.mul(mean)));

		return vec4(colorSum.div(count), std);
	},
);

type Options = {
	size: Node<"int">;
};

export const kuwahara = /*@__PURE__*/ Fn(
	([tex, { size = int(5) } = {}]: [
		tex: Texture | TextureNode,
		options?: Partial<Options>,
	]) => {
		const q1 = sample(tex, {
			size,
		});

		const color = q1.rgb;
		const minStd = q1.w;

		const q2 = sample(tex, {
			size,
			offset: vec2(size.mul(-1), size),
		});

		If(q2.w.lessThan(minStd), () => {
			minStd.assign(q2.w);
			color.assign(q2.rgb);
		});

		const q3 = sample(tex, {
			size,
			offset: vec2(size.mul(-1), size.mul(-1)),
		});

		If(q3.w.lessThan(minStd), () => {
			minStd.assign(q3.w);
			color.assign(q3.rgb);
		});

		const q4 = sample(tex, {
			size,
			offset: vec2(size, size.mul(-1)),
		});

		If(q4.w.lessThan(minStd), () => {
			minStd.assign(q4.w);
			color.assign(q4.rgb);
		});

		return vec4(color, 1.0);
	},
);
