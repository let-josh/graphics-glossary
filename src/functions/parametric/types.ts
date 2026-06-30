import type { ParametricGeometry } from "three/addons";

export type ParametricFunction = ConstructorParameters<
	typeof ParametricGeometry
>[0];
