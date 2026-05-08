import type { OrthographicCamera } from "three/webgpu";

export const setCameraPlanes = (
	camera: OrthographicCamera,
	width: number,
	height: number,
) => {
	const halfWidth = 0.5 * width;
	camera.left = -1 * halfWidth;
	camera.right = halfWidth;

	const halfHeight = 0.5 * height;
	camera.top = halfHeight;
	camera.bottom = -1 * halfHeight;

	camera.updateProjectionMatrix();
};
