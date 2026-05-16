import gltfUrl from "@assets/gltfs/IridescenceAbalone.glb";

import type { GLTFLoader } from "three/examples/jsm/Addons.js";

export const loadAbalone = (loader: GLTFLoader) => {
	return loader.loadAsync(gltfUrl);
};
