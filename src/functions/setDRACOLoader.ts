import { DRACOLoader } from "three/examples/jsm/Addons.js";
import type { GLTFLoader } from "three/examples/jsm/Addons.js";

const _dracoLoader = new DRACOLoader().setDecoderPath(
	"https://www.gstatic.com/draco/v1/decoders/",
);

export const setDRACOLoader = (
	gltfLoader: GLTFLoader,
	dracoLoader = _dracoLoader,
) => {
	gltfLoader.setDRACOLoader(dracoLoader);
};
