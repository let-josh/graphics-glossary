import { DEG2RAD } from "three/src/math/MathUtils.js";
import { Box3, Vector3 } from "three/webgpu";
import type { Object3D, PerspectiveCamera } from "three/webgpu";

export const fitCameraToObject = (
	camera: PerspectiveCamera,
	object: Object3D,
	{ box = new Box3(), size = new Vector3() } = {},
) => {
	box.setFromObject(object);
	box.getCenter(camera.position);

	box.getSize(size);
	const max = Math.max(...size);
	const distance = (0.5 * max) / Math.tan(DEG2RAD * 0.5 * camera.fov);
	camera.translateZ(distance);
};
