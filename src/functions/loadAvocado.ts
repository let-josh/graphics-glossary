import gltfUrl from "@assets/gltfs/avocado.glb";

import type { GLTFLoader } from "three/addons";

export const loadAvocado = (gltfLoader: GLTFLoader) => {
	return gltfLoader.loadAsync(gltfUrl);
};
