import { WebGPURenderer } from "three/webgpu";
import type { Camera, Scene } from "three/webgpu";

type Options = {
	count: number;
	size: number;
};

export const spriteSheetBlob = async (
	scene: Scene,
	camera: Camera,
	{ count = 8, size = 64 }: Partial<Options> = {},
) => {
	const canvas = new OffscreenCanvas(count * size, size);
	const renderer = new WebGPURenderer({
		canvas,
	});

	await renderer.init();
	renderer.render(scene, camera);
	const blob = await canvas.convertToBlob();
	renderer.dispose();
	return blob;
};
