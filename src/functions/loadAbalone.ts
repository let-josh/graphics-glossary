import { setDRACOLoader } from "./setDRACOLoader";

import gltfUrl from "@assets/gltfs/abalone.glb";

import type { GLTFLoader } from "three/examples/jsm/Addons.js";

/**
 * will set the `dracoloader` of the loader if it has not already been set
 */
export const loadAbalone = (gltfLoader: GLTFLoader) => {
	if (gltfLoader.dracoLoader === null) setDRACOLoader(gltfLoader);
	return gltfLoader.loadAsync(gltfUrl);
};
