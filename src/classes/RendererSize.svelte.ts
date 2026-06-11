import type { Size } from "./Size.svelte";

import { devicePixelRatio } from "svelte/reactivity/window";
import type { Renderer } from "three/webgpu";

export class RendererSize {
	width: number;
	height: number;
	constructor(width: () => number, height: () => number) {
		this.width = $derived(
			Math.floor(width() * (devicePixelRatio.current ?? 1)),
		);
		this.height = $derived(
			Math.floor(height() * (devicePixelRatio.current ?? 1)),
		);
	}

	static fromSize(size: Size) {
		return new RendererSize(
			() => size.width,
			() => size.height,
		);
	}
}

export const setRendererSize = (renderer: Renderer, size: RendererSize) => {
	renderer.setSize(size.width, size.height, false);
};
