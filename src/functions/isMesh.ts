import type { Mesh } from "three/webgpu";

export const isMesh = (o: unknown): o is Mesh =>
	typeof o === "object" && o !== null && "isMesh" in o && o.isMesh === true;
