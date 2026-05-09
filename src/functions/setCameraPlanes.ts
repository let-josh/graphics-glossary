import type { OrthographicCamera } from "three/webgpu";

export const setCameraPlanes = (
	camera: OrthographicCamera,
	width: number,
	height: number,
) => {
	camera.left = -1 * width;
	camera.right = width;

	camera.top = height;
	camera.bottom = -1 * height;

	camera.updateProjectionMatrix();
};
