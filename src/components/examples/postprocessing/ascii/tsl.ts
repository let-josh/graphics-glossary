import {
	Fn,
	float,
	luminance,
	screenCoordinate,
	screenSize,
	texture,
	vec4,
} from "three/tsl";
import type { Node, Texture, TextureNode } from "three/webgpu";

type FloatOrNumber = Node<"float"> | number;

type Options = {
	glyphSize: FloatOrNumber;
};

export const ascii = /*@__PURE__*/ Fn(
	([tex, charsTex, charsCount, { glyphSize = charsCount } = {}]: [
		tex: Texture | TextureNode,
		charsTex: Texture | TextureNode,
		charsCount: Node<"float"> | number,
		options?: Partial<Options>,
	]): Node<"vec4"> => {
		const p = screenCoordinate.div(glyphSize);

		const uv = p.floor().mul(glyphSize).div(screenSize);

		const color = texture(tex, uv);

		const cc = typeof charsCount === "number" ? float(charsCount) : charsCount;

		const lum = luminance(color.rgb).mul(cc.sub(1)).clamp(0, cc.sub(1)).floor();

		const cellUv = p.fract();
		cellUv.x.addAssign(lum);
		cellUv.x.divAssign(cc);

		return vec4(texture(charsTex, cellUv).rgb.mul(color.rgb), 1);
	},
);
