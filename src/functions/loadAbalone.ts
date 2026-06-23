import gltfUrl from "@assets/gltfs/abalone.glb";

import type { GLTFLoader } from "three/examples/jsm/Addons.js";

/**
 * will set the `dracoLoader` of the loader if it has not already been set
 */
export const loadAbalone = (gltfLoader: GLTFLoader) => {
	return gltfLoader.loadAsync(gltfUrl);
};
