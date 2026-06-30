import gltfUrl from "@assets/gltfs/abalone.glb";

import type { GLTFLoader } from "three/addons";

export const loadAbalone = (gltfLoader: GLTFLoader) => {
	return gltfLoader.loadAsync(gltfUrl);
};
